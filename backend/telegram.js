import db from './db.js';

let isPolling = false;
let pollingTimeout = null;
let lastUpdateId = 0;
let isCurrentlyFetching = false;

// In-memory update de-duplication
const processedUpdates = new Set();

// Cache of recently sent OTPs to prevent duplicate delivery
// Key: phone or chatId -> { code: string, sentAt: number }
const lastSentOtp = new Map();

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

/**
 * Centralized, de-duplicated OTP delivery to a user.
 * - Reuses existing valid OTP from DB (valid for 10 minutes).
 * - Debounces: If code was sent to this phone or chatId within 20 seconds, DO NOT SEND AGAIN.
 * - Returns { ok: true, code, sentToTelegram: boolean, debounced?: boolean }
 */
export async function sendOtpToUser(phone, user = null, chatId = null) {
  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  // 1. Get or generate OTP
  const now = Date.now();
  let existingOtp = db.prepare(`
    SELECT code, expires_at FROM otp_codes 
    WHERE phone = ? AND expires_at > ? 
    ORDER BY id DESC LIMIT 1
  `).get(cleanPhone, now);

  let code;
  if (existingOtp) {
    code = existingOtp.code;
  } else {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = now + 10 * 60 * 1000;
    db.prepare('INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(
      cleanPhone,
      code,
      expiresAt
    );
  }

  // 2. Determine target chatId
  let targetChatId = chatId;
  if (!targetChatId && user?.telegram_chat_id) {
    targetChatId = user.telegram_chat_id;
  }
  if (!targetChatId) {
    const userInDb = db.prepare('SELECT telegram_chat_id, full_name, role_title FROM users WHERE phone = ?').get(cleanPhone);
    if (userInDb?.telegram_chat_id) {
      targetChatId = userInDb.telegram_chat_id;
      if (!user) user = userInDb;
    }
  }

  // 3. If no chatId is known, we cannot send directly to Telegram yet (user must open bot via link)
  if (!targetChatId) {
    return { ok: true, code, sentToTelegram: false };
  }

  // 4. Strict Debounce Check: Has code been sent to this phone or chatId in the last 20 seconds?
  const phoneCache = lastSentOtp.get(cleanPhone);
  const chatCache = lastSentOtp.get(String(targetChatId));
  const isRecentPhone = phoneCache && (now - phoneCache.sentAt < 20000);
  const isRecentChat = chatCache && (now - chatCache.sentAt < 20000);

  if (isRecentPhone || isRecentChat) {
    console.log(`[Telegram] Debounced duplicate OTP for ${cleanPhone} (already sent recently)`);
    return { ok: true, code, sentToTelegram: true, debounced: true };
  }

  // 5. Send Telegram Message
  const name = user?.full_name ? `<b>${user.full_name}</b>!` : 'ҳурматли ходим!';
  const messageText = 
    `🫖 <b>Чархпалак Чойхонаси</b>\n\n` +
    `Ассалому алайкум, ${name}\n` +
    `🔐 <b>Сизнинг кириш кодингиз:</b> <code>${code}</code>\n\n` +
    `Ушбу кодни дастурга киритинг. Код муддати: 10 дақиқа.`;

  const sent = await sendTelegramMessage(targetChatId, messageText);
  if (sent) {
    const record = { code, sentAt: now };
    lastSentOtp.set(cleanPhone, record);
    lastSentOtp.set(String(targetChatId), record);
  }

  return { ok: true, code, sentToTelegram: sent };
}

async function handleTelegramUpdate(update) {
  if (!update || !update.update_id) return;

  // De-duplicate update_ids
  if (processedUpdates.has(update.update_id)) return;
  processedUpdates.add(update.update_id);
  if (processedUpdates.size > 2000) {
    const firstItems = Array.from(processedUpdates).slice(0, 500);
    firstItems.forEach(id => processedUpdates.delete(id));
  }

  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = msg.text || '';

  // 1. Handle /start command
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const param = parts[1] || '';

    // Format: /start auth_998901234567
    if (param.startsWith('auth_')) {
      const cleanPhone = '+' + param.replace('auth_', '').replace(/\D/g, '');
      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);

      if (user) {
        // Link chat ID
        db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(String(chatId), user.id);
      }

      // Send OTP to user (will reuse existing active code, and debounce if already sent)
      await sendOtpToUser(cleanPhone, user, chatId);
      return;
    }

    // Default /start greeting (when opened directly without auth param)
    const existingUser = db.prepare('SELECT * FROM users WHERE telegram_chat_id = ?').get(String(chatId));
    if (existingUser) {
      await sendTelegramMessage(
        chatId,
        `🫖 <b>Чархпалак Чойхонаси</b>\n\n` +
        `Ассалому алайкум, <b>${existingUser.full_name}</b> (${existingUser.role_title})!\n` +
        `Сизнинг Telegram ҳисобингиз тизимга уланган.\n` +
        `Кириш кодини олиш учун сайтга кириб телефон рақамингизни ёзинг.`
      );
      return;
    }

    // Unlinked user: offer Contact sharing button
    await sendTelegramMessage(
      chatId,
      `🫖 <b>Чархпалак Чойхонаси расмий ботига хуш келибсиз!</b>\n\n` +
      `Ушбу бот ходимларга кириш кодини юбориш ва тўловларни хабар қилиш учун ишлатилади.\n\n` +
      `Телефон рақамингизни тизимга улаш учун қуйидаги тугмани босинг:`,
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

  // 2. Handle Contact sharing
  if (msg.contact) {
    let phone = msg.contact.phone_number;
    if (!phone.startsWith('+')) phone = '+' + phone;

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (user) {
      db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(String(chatId), user.id);
      await sendOtpToUser(phone, user, chatId);
    } else {
      await sendTelegramMessage(
        chatId,
        `❌ Телефон рақамингиз (${phone}) ходимлар базасида топилмади.\nИлтимос, аввал сайтда рўйхатдан ўтинг.`
      );
    }
    return;
  }
}

async function pollUpdates() {
  if (!isPolling || isCurrentlyFetching) return;
  isCurrentlyFetching = true;

  const { token } = getBotConfig();
  if (!token) {
    isPolling = false;
    isCurrentlyFetching = false;
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          await handleTelegramUpdate(update);
        }
      }
    }
  } catch (err) {
    // Network retry, ignore
  } finally {
    isCurrentlyFetching = false;
    if (isPolling) {
      pollingTimeout = setTimeout(pollUpdates, 1500);
    }
  }
}

export async function startPolling() {
  const { token } = getBotConfig();
  if (!token) return;
  if (isPolling) return; // Prevent duplicate loops
  isPolling = true;

  console.log('🤖 Telegram bot polling фаоллашди (@charxpalak_authbot).');

  // DISCARD ALL OLD PENDING UPDATES ON BOT STARTUP!
  // By querying offset=-1, Telegram returns only the latest update.
  // Then acknowledging offset=update_id+1 drops the entire backlog.
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-1`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        lastUpdateId = data.result[0].update_id;
        await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}`);
        console.log(`[Telegram] Backlog cleared up to update_id ${lastUpdateId}`);
      }
    }
  } catch (err) {
    console.error('[Telegram] Failed to clear backlog on boot:', err.message);
  }

  pollUpdates();
}

export function stopPolling() {
  isPolling = false;
  isCurrentlyFetching = false;
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
}

export function restartPolling() {
  stopPolling();
  setTimeout(() => {
    startPolling();
  }, 1000);
}
