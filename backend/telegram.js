import db from './db.js';

let isPolling = false;
let pollingInterval = null;
let lastUpdateId = 0;

export function getBotConfig() {
  const tokenRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('TELEGRAM_BOT_TOKEN');
  const userRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('TELEGRAM_BOT_USERNAME');
  return {
    token: tokenRow?.value || '8864236616:AAFhhyZay4tnhiQlVrjX5S7BftiUCH-tOcQ',
    username: userRow?.value || 'charxpalak_authbot'
  };
}

export function updateBotConfig(token, username) {
  const insert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  insert.run('TELEGRAM_BOT_TOKEN', token.trim());
  if (username) {
    insert.run('TELEGRAM_BOT_USERNAME', username.trim().replace(/^@/, ''));
  }
  restartPolling();
}

export async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const { token } = getBotConfig();
  if (!token || !chatId) return false;

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data.ok;
  } catch (err) {
    console.error('Telegram sendMessage error:', err.message);
    return false;
  }
}

async function handleTelegramUpdate(update) {
  if (!update.message) return;
  const msg = update.message;
  const chatId = msg.chat.id;
  const text = msg.text || '';

  // Check /start command
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const param = parts[1] || '';

    // Format: /start auth_998901234567
    if (param.startsWith('auth_')) {
      const cleanPhone = '+' + param.replace('auth_', '').replace(/\D/g, '');
      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);

      if (!user) {
        await sendTelegramMessage(
          chatId,
          `❌ <b>Кечирасиз!</b>\n\nУшбу телефон рақам (${cleanPhone}) "Чархпалак Чойхонаси" ходимлар рўйхатида топилмади.\nИлтимос, иш юритувчи ёки раҳбариятга мурожаат қилинг.`
        );
        return;
      }

      // Link chat ID
      db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(String(chatId), user.id);

      // Generate 4-digit OTP code
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      db.prepare('INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(
        cleanPhone,
        code,
        expiresAt
      );

      await sendTelegramMessage(
        chatId,
        `🫖 <b>Чархпалак Чойхонаси</b>\n` +
        `Ассалому алайкум, <b>${user.full_name}</b> (${user.role_title})!\n\n` +
        `🔐 <b>Сизнинг кириш кодингиз:</b> <code>${code}</code>\n\n` +
        `Ушбу кодни дастурга киритинг. Код муддати: 10 дақиқа. ✅`
      );
      return;
    }

    // Default /start greeting with contact button
    await sendTelegramMessage(
      chatId,
      `🫖 <b>Чархпалак Чойхонаси расмий ботига хуш келибсиз!</b>\n\n` +
      `Ушбу бот ходимларга кириш коди ва хабарномаларни юбориш учун ишлатилади.\n\n` +
      `Кириш кодини олиш учун дастур орқали "Telegram ботдан код олиш" тугмасини босинг ёки телефон рақамингизни юборинг.`,
      {
        keyboard: [
          [{ text: '📱 Телефон рақамни юбориш', request_contact: true }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    );
    return;
  }

  // Handle Contact sharing
  if (msg.contact) {
    let phone = msg.contact.phone_number;
    if (!phone.startsWith('+')) phone = '+' + phone;

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (user) {
      db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(String(chatId), user.id);
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      db.prepare('INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(phone, code, expiresAt);

      await sendTelegramMessage(
        chatId,
        `🫖 <b>Чархпалак Чойхонаси</b>\n` +
        `Хуш келибсиз, <b>${user.full_name}</b> (${user.role_title})!\n\n` +
        `🔐 <b>Кириш кодингиз:</b> <code>${code}</code>\n\n` +
        `Ҳисобингиз муваффақиятли уланди!`
      );
    } else {
      await sendTelegramMessage(
        chatId,
        `❌ Телефон рақамингиз (${phone}) ходимлар базасида топилмади. Раҳбарият билан боғланинг.`
      );
    }
  }
}

async function pollUpdates() {
  const { token } = getBotConfig();
  if (!token) {
    isPolling = false;
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          await handleTelegramUpdate(update);
        }
      }
    }
  } catch (err) {
    // Network retry
  }

  if (isPolling) {
    pollingInterval = setTimeout(pollUpdates, 2000);
  }
}

export function startPolling() {
  const { token } = getBotConfig();
  if (!token || isPolling) return;
  isPolling = true;
  console.log('🤖 Telegram bot polling faollashdi (@charxpalak_authbot).');
  pollUpdates();
}

export function stopPolling() {
  isPolling = false;
  if (pollingInterval) clearTimeout(pollingInterval);
}

export function restartPolling() {
  stopPolling();
  setTimeout(() => {
    startPolling();
  }, 1000);
}
