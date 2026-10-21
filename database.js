import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'charxpalak_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const TOP_3_ROLES = ['OWNER', 'SUPERVISOR', 'MANAGER'];

export function isTop3Role(roleId) {
  return TOP_3_ROLES.includes(roleId);
}

export const ROLES_CONFIG = [
  { id: 'CASHIER', title: 'Кассир', icon: '💳' },
  { id: 'BUTCHER', title: 'Қассоб', icon: '🥩' },
  { id: 'HEAD_CHEF', title: 'Бош ошпаз', icon: '👨‍🍳' },
  { id: 'SHASHLIK_CHEF', title: 'Шашликчи ошпаз', icon: '🍢' },
  { id: 'SOMSA_CHEF', title: 'Сомсапаз', icon: '🥟' },
  { id: 'COOK', title: 'Ошпаз', icon: '🍲' },
  { id: 'SUPPLIER', title: 'Таъминотчи (Харидчи)', icon: '🚚' },
  { id: 'DISHWASHER', title: 'Идиш ювувчи', icon: '🧼' },
  { id: 'CUSTOM', title: 'Бошқа лавозим...', icon: '🍴' }
];

const INITIAL_DATA = {
  users: [
    {
      id: 1,
      telegram_id: null,
      phone: '+998900000001',
      full_name: 'Каюмов Жамшидбек',
      role_id: 'OWNER',
      role_title: 'Мулкдор (Эга)',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      telegram_id: null,
      phone: '+998900000002',
      full_name: 'Басиржонов Жавлонбек',
      role_id: 'SUPERVISOR',
      role_title: 'Иш бошқарувчи (РР)',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      telegram_id: null,
      phone: '+998900000003',
      full_name: 'Паҳлавон',
      role_id: 'MANAGER',
      role_title: 'Иш юритувчи (УД)',
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  transactions: [],
  settings: {
    restaurant_name: 'Чархпалак Чойхонаси',
    bot_token: '8864236616:AAFhhyZay4tnhiQlVrjX5S7BftiUCH-tOcQ',
    bot_username: 'charxpalak_authbot',
    master_key: '7777'
  }
};

class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure default structure
        return {
          users: parsed.users || INITIAL_DATA.users,
          transactions: parsed.transactions || [],
          settings: { ...INITIAL_DATA.settings, ...(parsed.settings || {}) }
        };
      }
    } catch (err) {
      console.error('Database load warning, resetting to initial:', err.message);
    }
    this.save(INITIAL_DATA);
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  save(dataToSave = this.data) {
    try {
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Database save error:', err.message);
    }
  }

  // ---------------- USER OPERATIONS ----------------

  getUserByTelegramId(telegramId) {
    if (!telegramId) return null;
    const tidStr = String(telegramId);
    return this.data.users.find(u => String(u.telegram_id) === tidStr) || null;
  }

  getUserById(id) {
    const numId = parseInt(id, 10);
    return this.data.users.find(u => u.id === numId) || null;
  }

  getUserByPhone(phone) {
    if (!phone) return null;
    let clean = phone.replace(/[^\d+]/g, '');
    if (!clean.startsWith('+')) clean = '+' + clean;
    return this.data.users.find(u => u.phone === clean) || null;
  }

  getTop3Leaders() {
    return this.data.users.filter(u => isTop3Role(u.role_id) && u.is_active);
  }

  getUnboundLeaders() {
    return this.data.users.filter(u => 
      isTop3Role(u.role_id) && (!u.telegram_id || u.phone.startsWith('+99890000000'))
    );
  }

  getActiveEmployees(excludeUserId = null) {
    return this.data.users.filter(u => 
      u.is_active && (!excludeUserId || u.id !== parseInt(excludeUserId, 10))
    );
  }

  getPendingApplicants() {
    return this.data.users.filter(u => !u.is_active);
  }

  createApplicant({ phone, full_name, role_id, role_title, telegram_id }) {
    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    const nextId = this.data.users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    const newApplicant = {
      id: nextId,
      telegram_id: telegram_id ? String(telegram_id) : null,
      phone: cleanPhone,
      full_name: full_name.trim(),
      role_id: role_id || 'OTHER',
      role_title: role_title || 'Чойхона ходими',
      is_active: false,
      created_at: new Date().toISOString()
    };

    this.data.users.push(newApplicant);
    this.save();
    return newApplicant;
  }

  bindLeader(leaderId, telegramId, phone = null, fullName = null) {
    const leader = this.getUserById(leaderId);
    if (!leader || !isTop3Role(leader.role_id)) return null;

    leader.telegram_id = String(telegramId);
    if (phone) {
      let cleanPhone = phone.replace(/[^\d+]/g, '');
      if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
      leader.phone = cleanPhone;
    }
    if (fullName && fullName.trim()) {
      leader.full_name = fullName.trim();
    }
    leader.is_active = true;
    this.save();
    return leader;
  }

  approveApplicant(userId) {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.is_active = true;
    this.save();
    return user;
  }

  rejectApplicant(userId) {
    const index = this.data.users.findIndex(u => u.id === parseInt(userId, 10));
    if (index === -1) return null;
    const removed = this.data.users.splice(index, 1)[0];
    this.save();
    return removed;
  }

  updateUser(id, updates) {
    const user = this.getUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  // ---------------- TRANSACTION OPERATIONS ----------------

  createTransaction({
    sender_id,
    sender_full_name,
    sender_role_title,
    receiver_id,
    receiver_full_name,
    receiver_role_title,
    amount,
    category = 'Бошқа',
    comment = ''
  }) {
    const nextId = this.data.transactions.reduce((max, t) => Math.max(max, t.id), 0) + 1;

    // IMMUTABLE HISTORICAL RECORD:
    // Captures exact names and roles frozen at the moment of transfer!
    const newTx = {
      id: nextId,
      sender_id: parseInt(sender_id, 10),
      sender_full_name: sender_full_name.trim(),
      sender_role_title: sender_role_title.trim(),
      receiver_id: parseInt(receiver_id, 10),
      receiver_full_name: receiver_full_name.trim(),
      receiver_role_title: receiver_role_title.trim(),
      amount: parseInt(amount, 10),
      category: category.trim(),
      comment: (comment || '').trim(),
      status: 'PENDING',
      reject_reason: null,
      created_at: new Date().toISOString(),
      confirmed_at: null
    };

    this.data.transactions.push(newTx);
    this.save();
    return newTx;
  }

  getTransactionById(id) {
    const numId = parseInt(id, 10);
    return this.data.transactions.find(t => t.id === numId) || null;
  }

  confirmTransaction(id) {
    const tx = this.getTransactionById(id);
    if (!tx || tx.status !== 'PENDING') return null;

    tx.status = 'CONFIRMED';
    tx.confirmed_at = new Date().toISOString();
    this.save();
    return tx;
  }

  rejectTransaction(id, reason = '') {
    const tx = this.getTransactionById(id);
    if (!tx || tx.status !== 'PENDING') return null;

    tx.status = 'REJECTED';
    tx.reject_reason = (reason || 'Қабул қилувчи рад этди').trim();
    this.save();
    return tx;
  }

  getPendingIncomingForUser(userId) {
    const numId = parseInt(userId, 10);
    return this.data.transactions
      .filter(t => t.receiver_id === numId && t.status === 'PENDING')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getTransactionsForUser(userId, isTop3 = false, limit = 20) {
    const numId = parseInt(userId, 10);
    let list = this.data.transactions;

    if (!isTop3) {
      list = list.filter(t => t.sender_id === numId || t.receiver_id === numId);
    }

    return list
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  }

  getStats(userId = null, isTop3 = false) {
    const numId = userId ? parseInt(userId, 10) : null;
    const todayStr = new Date().toISOString().split('T')[0];

    const all = this.data.transactions;
    const relevant = isTop3 ? all : all.filter(t => t.sender_id === numId || t.receiver_id === numId);

    const confirmed = relevant.filter(t => t.status === 'CONFIRMED');
    const pending = relevant.filter(t => t.status === 'PENDING');
    const today = confirmed.filter(t => t.confirmed_at && t.confirmed_at.startsWith(todayStr));

    const totalGiven = relevant.reduce((sum, t) => sum + (t.status !== 'REJECTED' ? t.amount : 0), 0);
    const totalConfirmed = confirmed.reduce((sum, t) => sum + t.amount, 0);
    const totalPending = pending.reduce((sum, t) => sum + t.amount, 0);
    const todayConfirmed = today.reduce((sum, t) => sum + t.amount, 0);

    const pendingApplicantsCount = isTop3 ? this.getPendingApplicants().length : 0;
    const activeStaffCount = this.data.users.filter(u => u.is_active).length;

    return {
      isTop3,
      totalGiven,
      totalConfirmed,
      totalPending,
      pendingCount: pending.length,
      todayConfirmed,
      todayCount: today.length,
      pendingApplicantsCount,
      activeStaffCount
    };
  }

  // ---------------- SETTINGS ----------------

  getSetting(key, defaultValue = null) {
    return this.data.settings[key] ?? defaultValue;
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.save();
  }
}

const db = new Database();
export default db;
