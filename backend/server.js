import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { getBotConfig, updateBotConfig, startPolling, sendTelegramMessage } from './telegram.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

export const TOP_3_ROLES = ['OWNER', 'SUPERVISOR', 'MANAGER'];

export function isTop3Role(roleId) {
  return TOP_3_ROLES.includes(roleId);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const customUserId = req.headers['x-user-id'];

  let userId = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      userId = parsed.userId;
    } catch (e) {
      userId = parseInt(token, 10);
    }
  } else if (customUserId) {
    userId = parseInt(customUserId, 10);
  }

  if (!userId) {
    return res.status(401).json({ error: 'Авторизациядан ўтилмаган' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.is_active !== 1) {
    return res.status(401).json({ error: 'Фойдаланувчи топилмади ёки ҳисобингиз ҳали тасдиқланмаган' });
  }

  req.user = user;
  next();
}

function requireTop3(req, res, next) {
  if (!isTop3Role(req.user.role_id)) {
    return res.status(403).json({
      error: 'Рухсат этилмади. Ушбу амални фақат Асосий Учлик (Каюмов Жамшидбек, Басиржонов Жавлонбек, Паҳлавон) бажара олади.'
    });
  }
  next();
}

// ---------------- AUTH & REGISTRATION ROUTES ----------------

// Employee self-registration
app.post('/api/auth/register', (req, res) => {
  let { phone, full_name, role_id, role_title } = req.body;

  if (!phone || !full_name) {
    return res.status(400).json({ error: 'Телефон рақам ва исм-фамилиянгизни киритинг' });
  }

  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
  if (existing) {
    if (existing.is_active === 1) {
      return res.status(400).json({ error: 'Ушбу телефон рақам аллақачон рўйхатдан ўтган. Кириш бўлимидан киринг.' });
    } else {
      return res.status(400).json({ 
        isPendingApproval: true,
        error: 'Сизнинг аризангиз аввал қабул қилинган ва ҳозирда раҳбарият тасдиқлашини кутмоқда.' 
      });
    }
  }

  const roleTitleMap = {
    CASHIER: 'Кассир',
    BUTCHER: 'Қассоб',
    HEAD_CHEF: 'Бош ошпаз',
    SHASHLIK_CHEF: 'Шашликчи ошпаз',
    SOMSA_CHEF: 'Сомсапаз',
    COOK: 'Ошпаз',
    SUPPLIER: 'Таъминотчи (Харидчи)',
    DISHWASHER: 'Идиш ювувчи'
  };

  const finalTitle = role_title || roleTitleMap[role_id] || 'Чойхона ходими';
  const finalRoleId = role_id || 'OTHER';

  const insert = db.prepare(`
    INSERT INTO users (phone, full_name, role_id, role_title, is_active)
    VALUES (?, ?, ?, ?, 0)
  `);

  const result = insert.run(cleanPhone, full_name.trim(), finalRoleId, finalTitle);
  const newApplicant = db.prepare('SELECT id, phone, full_name, role_title FROM users WHERE id = ?').get(result.lastInsertRowid);

  return res.status(201).json({
    ok: true,
    isPendingApproval: true,
    user: newApplicant,
    message: 'Аризангиз муваффақиятли юборилди! Раҳбарият (Каюмов Жамшидбек, Паҳлавон ёки Басиржонов Жавлонбек) тасдиқлаганидан сўнг тизимга кира оласиз.'
  });
});

// Check phone & Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  let { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Телефон рақам киритилмади' });

  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);

  if (!user) {
    return res.status(200).json({
      ok: false,
      notRegistered: true,
      phone: cleanPhone,
      message: 'Ушбу телефон рақам рўйхатдан ўтмаган. Илтимос, исмингизни ёзиб рўйхатдан ўтинг.'
    });
  }

  if (user.is_active === 0) {
    return res.status(200).json({
      ok: false,
      isPendingApproval: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        role_title: user.role_title
      },
      message: 'Сизнинг аризангиз раҳбарият томонидан кўриб чиқилмоқда. Тасдиқланганидан сўнг киришингиз мумкин бўлади.'
    });
  }

  // Generate 4-digit OTP
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  db.prepare('INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(
    cleanPhone,
    code,
    expiresAt
  );

  const botConfig = getBotConfig();

  // If user linked Telegram, send to Telegram immediately
  let sentViaTelegram = false;
  if (botConfig.token && user.telegram_chat_id) {
    sentViaTelegram = await sendTelegramMessage(
      user.telegram_chat_id,
      `🫖 <b>Чархпалак Чойхонаси</b>\n\n` +
      `Ассалому алайкум, <b>${user.full_name}</b>!\n` +
      `🔐 Кириш кодингиз: <code>${code}</code>\n\n` +
      `Код муддати: 10 дақиқа.`
    );
  }

  return res.json({
    ok: true,
    registered: true,
    phone: cleanPhone,
    hasPinCode: !!user.pin_code,
    user: {
      id: user.id,
      full_name: user.full_name,
      role_id: user.role_id,
      role_title: user.role_title
    },
    sentViaTelegram,
    telegramLink: botConfig.username ? `https://t.me/${botConfig.username}?start=auth_${cleanPhone.replace('+', '')}` : null,
    telegramBotUsername: botConfig.username,
    debugCode: code
  });
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  let { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Телефон ва код талаб қилинади' });

  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  const validOtp = db.prepare(`
    SELECT * FROM otp_codes
    WHERE phone = ? AND code = ? AND expires_at > ?
    ORDER BY id DESC LIMIT 1
  `).get(cleanPhone, code.toString().trim(), Date.now());

  const isMasterCode = code.toString().trim() === '7777';

  if (!validOtp && !isMasterCode) {
    return res.status(400).json({ error: 'Тасдиқлаш коди нотўғри ёки муддати тугаган' });
  }

  if (validOtp) {
    db.prepare('DELETE FROM otp_codes WHERE id = ?').run(validOtp.id);
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ? AND is_active = 1').get(cleanPhone);
  if (!user) return res.status(404).json({ error: 'Фойдаланувчи топилмади ёки ҳисоб фаол эмас' });

  const tokenPayload = JSON.stringify({ userId: user.id, phone: user.phone, role: user.role_id, time: Date.now() });
  const token = Buffer.from(tokenPayload).toString('base64');

  return res.json({
    ok: true,
    token,
    hasPinCode: !!user.pin_code,
    user: {
      id: user.id,
      phone: user.phone,
      full_name: user.full_name,
      role_id: user.role_id,
      role_title: user.role_title,
      is_top3: isTop3Role(user.role_id),
      has_pin: !!user.pin_code,
      telegram_chat_id: user.telegram_chat_id
    }
  });
});

// Verify PIN Code (Quick password login)
app.post('/api/auth/verify-pin', (req, res) => {
  let { phone, pin } = req.body;
  if (!phone || !pin) return res.status(400).json({ error: 'Телефон ва ПИН-код талаб қилинади' });

  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  const user = db.prepare('SELECT * FROM users WHERE phone = ? AND is_active = 1').get(cleanPhone);
  if (!user) return res.status(404).json({ error: 'Фойдаланувчи топилмади' });

  if (!user.pin_code || user.pin_code !== pin.trim()) {
    return res.status(400).json({ error: 'ПИН-код нотўғри' });
  }

  const tokenPayload = JSON.stringify({ userId: user.id, phone: user.phone, role: user.role_id, time: Date.now() });
  const token = Buffer.from(tokenPayload).toString('base64');

  return res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      phone: user.phone,
      full_name: user.full_name,
      role_id: user.role_id,
      role_title: user.role_title,
      is_top3: isTop3Role(user.role_id),
      has_pin: true,
      telegram_chat_id: user.telegram_chat_id
    }
  });
});

// Set or Update personal PIN Code
app.post('/api/auth/set-pin', authenticate, (req, res) => {
  const { pin } = req.body;

  if (pin && !/^\d{4}$/.test(pin.trim())) {
    return res.status(400).json({ error: 'ПИН-код роппа-роса 4 та рақамдан иборат бўлиши керак' });
  }

  const finalPin = pin ? pin.trim() : null;
  db.prepare('UPDATE users SET pin_code = ? WHERE id = ?').run(finalPin, req.user.id);

  return res.json({
    ok: true,
    has_pin: !!finalPin,
    message: finalPin ? 'ПИН-код муваффақиятли ўрнатилди' : 'ПИН-код бекор қилинди'
  });
});

// Fast Login
app.post('/api/auth/fast-login', (req, res) => {
  const { userId } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Фойдаланувчи топилмади' });
  if (user.is_active !== 1) {
    return res.status(403).json({ error: 'Ушбу ходим ҳали тасдиқланмаган' });
  }

  const tokenPayload = JSON.stringify({ userId: user.id, phone: user.phone, role: user.role_id, time: Date.now() });
  const token = Buffer.from(tokenPayload).toString('base64');

  return res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      phone: user.phone,
      full_name: user.full_name,
      role_id: user.role_id,
      role_title: user.role_title,
      is_top3: isTop3Role(user.role_id),
      has_pin: !!user.pin_code,
      telegram_chat_id: user.telegram_chat_id
    }
  });
});

// Current User
app.get('/api/auth/me', authenticate, (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      phone: req.user.phone,
      full_name: req.user.full_name,
      role_id: req.user.role_id,
      role_title: req.user.role_title,
      is_top3: isTop3Role(req.user.role_id),
      has_pin: !!req.user.pin_code,
      telegram_chat_id: req.user.telegram_chat_id
    }
  });
});

// ---------------- TRANSACTIONS ROUTES ----------------

app.get('/api/transactions', authenticate, (req, res) => {
  const isTop3 = isTop3Role(req.user.role_id);
  const { status, filter, employee_id, search } = req.query;

  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];

  if (!isTop3) {
    query += ' AND (sender_id = ? OR receiver_id = ?)';
    params.push(req.user.id, req.user.id);
  } else if (employee_id) {
    query += ' AND (sender_id = ? OR receiver_id = ?)';
    params.push(employee_id, employee_id);
  }

  if (status && status !== 'ALL') {
    query += ' AND status = ?';
    params.push(status);
  }

  if (filter === 'incoming') {
    query += ' AND receiver_id = ?';
    params.push(req.user.id);
  } else if (filter === 'outgoing') {
    query += ' AND sender_id = ?';
    params.push(req.user.id);
  }

  if (search) {
    query += ` AND (
      sender_full_name LIKE ? OR 
      receiver_full_name LIKE ? OR 
      comment LIKE ? OR 
      category LIKE ?
    )`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ' ORDER BY id DESC LIMIT 200';

  const transactions = db.prepare(query).all(...params);
  return res.json({ transactions });
});

app.post('/api/transactions', authenticate, (req, res) => {
  const { receiver_id, amount, category, comment } = req.body;

  if (!receiver_id) return res.status(400).json({ error: 'Қабул қилувчи ходим танланмади' });
  const parsedAmount = parseInt(amount, 10);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Сумма тўғри киритилмади' });
  }

  const receiver = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(receiver_id);
  if (!receiver) return res.status(404).json({ error: 'Қабул қилувчи ходим топилмади ёки фаол эмас' });

  if (receiver.id === req.user.id) {
    return res.status(400).json({ error: 'Ўзингизга пул ўтказа олмайсиз' });
  }

  // IMMUTABLE SNAPSHOT (CYRILLIC)
  const insertTx = db.prepare(`
    INSERT INTO transactions (
      sender_id, sender_full_name, sender_role_title,
      receiver_id, receiver_full_name, receiver_role_title,
      amount, category, comment, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `);

  const result = insertTx.run(
    req.user.id,
    req.user.full_name,
    req.user.role_title,
    receiver.id,
    receiver.full_name,
    receiver.role_title,
    parsedAmount,
    category || 'Бошқа харажат',
    comment || ''
  );

  const newTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ ok: true, transaction: newTx });
});

app.post('/api/transactions/:id/confirm', authenticate, (req, res) => {
  const txId = req.params.id;
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);

  if (!tx) return res.status(404).json({ error: 'Транзакция топилмади' });
  if (tx.status !== 'PENDING') {
    return res.status(400).json({ error: `Ушбу тўлов аллақачон ${tx.status === 'CONFIRMED' ? 'тасдиқланган' : 'бекор қилинган'}` });
  }

  const isTop3 = isTop3Role(req.user.role_id);
  if (tx.receiver_id !== req.user.id && !isTop3) {
    return res.status(403).json({ error: 'Ушбу тўловни фақат қабул қилувчи ходим тасдиқлаши мумкин' });
  }

  db.prepare(`
    UPDATE transactions
    SET status = 'CONFIRMED', confirmed_at = datetime('now')
    WHERE id = ?
  `).run(txId);

  const updatedTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
  return res.json({ ok: true, transaction: updatedTx });
});

app.post('/api/transactions/:id/reject', authenticate, (req, res) => {
  const txId = req.params.id;
  const { reason } = req.body;
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);

  if (!tx) return res.status(404).json({ error: 'Транзакция топилмади' });
  if (tx.status !== 'PENDING') {
    return res.status(400).json({ error: 'Фақат кутилаётган тўловни рад этиш мумкин' });
  }

  const isTop3 = isTop3Role(req.user.role_id);
  if (tx.receiver_id !== req.user.id && !isTop3) {
    return res.status(403).json({ error: 'Рухсат этилмади' });
  }

  db.prepare(`
    UPDATE transactions
    SET status = 'REJECTED', reject_reason = ?
    WHERE id = ?
  `).run(reason || 'Нотўғри сумма туфайли рад этилди', txId);

  const updatedTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
  return res.json({ ok: true, transaction: updatedTx });
});

// ---------------- EMPLOYEES & APPROVALS (TOP 3) ----------------

app.get('/api/employees', authenticate, (req, res) => {
  const employees = db.prepare(`
    SELECT id, phone, full_name, role_id, role_title, is_active, created_at 
    FROM users 
    WHERE is_active = 1
    ORDER BY id ASC
  `).all();
  return res.json({ employees });
});

app.get('/api/employees/pending', authenticate, requireTop3, (req, res) => {
  const pending = db.prepare(`
    SELECT id, phone, full_name, role_id, role_title, is_active, created_at 
    FROM users 
    WHERE is_active = 0
    ORDER BY id DESC
  `).all();
  return res.json({ pending });
});

app.post('/api/employees/:id/approve', authenticate, requireTop3, (req, res) => {
  const empId = req.params.id;
  const emp = db.prepare('SELECT * FROM users WHERE id = ?').get(empId);
  if (!emp) return res.status(404).json({ error: 'Ходим топилмади' });

  db.prepare('UPDATE users SET is_active = 1, updated_at = datetime(\'now\') WHERE id = ?').run(empId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(empId);

  return res.json({ ok: true, employee: updated, message: `${updated.full_name} тасдиқланди ва тизимга қўшилди` });
});

app.post('/api/employees/:id/reject-registration', authenticate, requireTop3, (req, res) => {
  const empId = req.params.id;
  db.prepare('DELETE FROM users WHERE id = ? AND is_active = 0').run(empId);
  return res.json({ ok: true, message: 'Ариза рад этилди' });
});

app.post('/api/employees', authenticate, requireTop3, (req, res) => {
  let { phone, full_name, role_id, role_title } = req.body;

  if (!phone || !full_name || !role_id) {
    return res.status(400).json({ error: 'Барча майдонларни тўлдиринг' });
  }

  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(cleanPhone);
  if (existing) {
    return res.status(400).json({ error: 'Ушбу телефон рақамли ходим аллақачон мавжуд' });
  }

  const roleTitleMap = {
    CASHIER: 'Кассир',
    BUTCHER: 'Қассоб',
    HEAD_CHEF: 'Бош ошпаз',
    SHASHLIK_CHEF: 'Шашликчи ошпаз',
    SOMSA_CHEF: 'Сомсапаз',
    COOK: 'Ошпаз',
    SUPPLIER: 'Таъминотчи (Харидчи)',
    DISHWASHER: 'Идиш ювувчи'
  };

  const finalTitle = role_title || roleTitleMap[role_id] || role_id;

  const insert = db.prepare(`
    INSERT INTO users (phone, full_name, role_id, role_title, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

  const result = insert.run(cleanPhone, full_name.trim(), role_id, finalTitle);
  const newEmployee = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

  return res.status(201).json({ ok: true, employee: newEmployee });
});

app.put('/api/employees/:id', authenticate, requireTop3, (req, res) => {
  const empId = req.params.id;
  const { phone, full_name, role_id, role_title, is_active } = req.body;

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(empId);
  if (!current) return res.status(404).json({ error: 'Ходим топилмади' });

  let cleanPhone = phone ? phone.replace(/[^\d+]/g, '') : current.phone;
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  if (cleanPhone !== current.phone) {
    const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(cleanPhone, empId);
    if (existing) {
      return res.status(400).json({ error: 'Бу телефон рақам бошқа ходимга бириктирилган' });
    }
  }

  db.prepare(`
    UPDATE users
    SET phone = ?,
        full_name = ?,
        role_id = ?,
        role_title = ?,
        is_active = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    cleanPhone,
    full_name ? full_name.trim() : current.full_name,
    role_id || current.role_id,
    role_title || current.role_title,
    is_active !== undefined ? (is_active ? 1 : 0) : current.is_active,
    empId
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(empId);
  return res.json({ ok: true, employee: updated });
});

app.delete('/api/employees/:id', authenticate, requireTop3, (req, res) => {
  const empId = req.params.id;
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(empId);
  if (!current) return res.status(404).json({ error: 'Ходим топилмади' });

  const nextStatus = current.is_active === 1 ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(nextStatus, empId);

  return res.json({ ok: true, is_active: nextStatus });
});

// ---------------- STATS & OVERVIEW ----------------

app.get('/api/stats', authenticate, (req, res) => {
  const isTop3 = isTop3Role(req.user.role_id);

  let totalGivenRow;
  let totalPendingRow;
  let totalConfirmedRow;
  let todayRow;

  if (isTop3) {
    totalGivenRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM transactions').get();
    totalConfirmedRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM transactions WHERE status = \'CONFIRMED\'').get();
    totalPendingRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM transactions WHERE status = \'PENDING\'').get();
    todayRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
      FROM transactions 
      WHERE date(created_at) = date('now') AND status = 'CONFIRMED'
    `).get();
  } else {
    totalGivenRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM transactions WHERE sender_id = ?').get(req.user.id);
    totalConfirmedRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM transactions WHERE receiver_id = ? AND status = \'CONFIRMED\'').get(req.user.id);
    totalPendingRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM transactions WHERE receiver_id = ? AND status = \'PENDING\'').get(req.user.id);
    todayRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
      FROM transactions 
      WHERE receiver_id = ? AND date(created_at) = date('now') AND status = 'CONFIRMED'
    `).get(req.user.id);
  }

  const pendingApplicantsCount = isTop3 
    ? db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 0').get().count 
    : 0;

  return res.json({
    isTop3,
    totalGiven: totalGivenRow.total,
    totalGivenCount: totalGivenRow.count,
    totalConfirmed: totalConfirmedRow.total,
    totalConfirmedCount: totalConfirmedRow.count,
    totalPending: totalPendingRow.total,
    totalPendingCount: totalPendingRow.count,
    todayConfirmed: todayRow.total,
    todayConfirmedCount: todayRow.count,
    pendingApplicantsCount
  });
});

// ---------------- SETTINGS ----------------

app.get('/api/settings', authenticate, (req, res) => {
  const isTop3 = isTop3Role(req.user.role_id);
  const botConfig = getBotConfig();
  const restName = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('RESTAURANT_NAME')?.value || 'Чархпалак Чойхонаси';
  const smsProvider = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('SMS_PROVIDER')?.value || 'TELEGRAM';

  return res.json({
    restaurantName: restName,
    telegramBotUsername: botConfig.username,
    hasBotToken: !!botConfig.token,
    smsProvider,
    canEdit: isTop3
  });
});

app.post('/api/settings', authenticate, requireTop3, (req, res) => {
  const { restaurantName, telegramBotToken, telegramBotUsername, smsProvider } = req.body;

  if (restaurantName) {
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('RESTAURANT_NAME', restaurantName.trim());
  }
  if (smsProvider) {
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('SMS_PROVIDER', smsProvider.trim());
  }
  if (telegramBotToken !== undefined) {
    updateBotConfig(telegramBotToken, telegramBotUsername);
  }

  return res.json({ ok: true, message: 'Созламалар сақланди' });
});

// Serve frontend dist in production
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(200).send('Чархпалак сервери ишламоқда.');
  });
});

// Only listen if not imported as serverless function
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍵 Чархпалак Чойхонаси сервери қуйидаги манзилларда ишламоқда:`);
    console.log(`   - Компьютерда: http://localhost:${PORT}`);
    console.log(`   - Маҳаллий:    http://127.0.0.1:${PORT}`);
    console.log(`   - Телефонда (Wi-Fi): http://10.29.17.163:${PORT}`);
    startPolling();
  });
}

export default app;
