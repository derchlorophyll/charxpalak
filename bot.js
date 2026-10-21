import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { isTop3Role, ROLES_CONFIG } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN || db.getSetting('bot_token') || '8864236616:AAFhhyZay4tnhiQlVrjX5S7BftiUCH-tOcQ';
const PORT = process.env.PORT || 4000;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());

// Serve Mini App
app.use(express.static(path.join(__dirname, 'miniapp')));

// In-memory conversation states for interactive dialogs
// userId -> { step, data: {} }
const userStates = new Map();

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('uz-UZ') + ' сўм';
}

function getMainMenuKeyboard(user) {
  const isTop3 = isTop3Role(user.role_id);
  const miniappUrl = RENDER_EXTERNAL_URL ? `${RENDER_EXTERNAL_URL}/index.html` : '';

  const buttons = [
    ['💸 Пул бериш', '📥 Келган тўловлар'],
    ['📜 Ўтказмалар тарихи', '👤 Профилим']
  ];

  if (miniappUrl && miniappUrl.startsWith('https://')) {
    buttons.push([Markup.button.webApp('📱 Мини Эпп (Интерактив)', miniappUrl)]);
  }

  if (isTop3) {
    buttons.push(['📊 Чойхона ҳисоботи', '👥 Ходимлар рўйхати']);
  }

  return Markup.keyboard(buttons).resize();
}

// ---------------- TELEGRAM BOT LOGIC ----------------

// 1. /start command
bot.start(async (ctx) => {
  const telegramId = String(ctx.from.id);
  userStates.delete(telegramId);

  const user = db.getUserByTelegramId(telegramId);

  // If already registered and approved
  if (user && user.is_active) {
    return ctx.reply(
      `🫖 <b>Чархпалак Чойхонаси</b>\n\n` +
      `Ассалому алайкум, <b>${user.full_name}</b>!\n` +
      `Лавозим: <b>${user.role_title}</b>\n\n` +
      `Керакли бўлимни танланг:`,
      {
        parse_mode: 'HTML',
        ...getMainMenuKeyboard(user)
      }
    );
  }

  // If registered but pending approval
  if (user && !user.is_active) {
    return ctx.reply(
      `⏳ <b>Аризангиз кўриб чиқилмоқда</b>\n\n` +
      `Ҳурматли <b>${user.full_name}</b> (${user.role_title}), сизнинг рўйхатдан ўтиш аризангиз раҳбариятга юборилган.\n\n` +
      `Раҳбарият (Жамшидбек, Жавлонбек ёки Паҳлавон) тасдиқлаганидан сўнг сизга хабар келади ва бот фаоллашади.`,
      { parse_mode: 'HTML' }
    );
  }

  // Unregistered user welcome: EVERYONE connects by sending their phone number!
  return ctx.reply(
    `🫖 <b>Чархпалак Чойхонаси расмий ботига хуш келибсиз!</b>\n\n` +
    `Ушбу бот ходимлар ва пул ҳаракатини ҳисобга олиш учун мўлжалланган.\n\n` +
    `Тизимга уланиш учун пастдаги тугмани босиб телефон рақамингизни юборинг:`,
    {
      parse_mode: 'HTML',
      ...Markup.keyboard([
        [Markup.button.contactRequest('📱 Телефон рақамни юбориш')]
      ]).resize().oneTime()
    }
  );
});

// 2. Contact Sharing (Universal Connection Step)
bot.on('contact', async (ctx) => {
  const telegramId = String(ctx.from.id);
  let phone = ctx.message.contact.phone_number;
  if (!phone.startsWith('+')) phone = '+' + phone;

  // Check if this phone belongs to a known user in the system
  let user = db.getUserByPhone(phone);
  if (user) {
    user.telegram_id = telegramId;
    db.save();
    if (user.is_active) {
      return ctx.reply(
        `✅ Телефон рақамингиз тасдиқланди!\nХуш келибсиз, <b>${user.full_name}</b> (${user.role_title})!`,
        {
          parse_mode: 'HTML',
          ...getMainMenuKeyboard(user)
        }
      );
    } else {
      return ctx.reply(
        `⏳ Сизнинг аризангиз раҳбарият томонидан кўриб чиқилмоқда. Тасдиқлангач сизга хабар берамиз.`
      );
    }
  }

  // New user registration: ask for full name
  userStates.set(telegramId, {
    step: 'AWAITING_NAME',
    phone: phone
  });

  return ctx.reply(
    `✅ Телефон рақамингиз қабул қилинди: <b>${phone}</b>\n\n` +
    `Илтимос, <b>Фамилия ва Исмингизни</b> киритинг:\n<i>(Масалан: Каримов Жасур ёки Каюмов Жамшидбек)</i>`,
    {
      parse_mode: 'HTML',
      ...Markup.removeKeyboard()
    }
  );
});

// 3. Bind Leadership Account (Directly from Role list upon phone connection)
bot.action(/bind_leader_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);
  const state = userStates.get(telegramId);

  if (!state || state.step !== 'AWAITING_ROLE') {
    return ctx.reply('Илтимос, /start ни босиб қайтадан бошланг.');
  }

  const leaderId = parseInt(ctx.match[1], 10);
  const leader = db.bindLeader(leaderId, telegramId, state.phone, state.fullName);

  userStates.delete(telegramId);

  if (!leader) return ctx.reply('Раҳбар топилмади ёки аллақачон бириктирилган.');

  await ctx.editMessageText(
    `🎉 <b>Табриклаймиз!</b>\n\n` +
    `Сизнинг телефон рақамингиз (<b>${state.phone}</b>) <b>${leader.full_name}</b> (${leader.role_title}) сифатида муваффақиятли уланди!`,
    { parse_mode: 'HTML' }
  );

  return ctx.reply(
    `Асосий меню очилди:`,
    getMainMenuKeyboard(leader)
  );
});

// 4. Role Selection for New Employee
bot.action(/role_sel_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);
  const state = userStates.get(telegramId);

  if (!state || state.step !== 'AWAITING_ROLE') {
    return ctx.reply('Илтимос, /start ни босиб қайтадан бошланг.');
  }

  const roleId = ctx.match[1];
  const roleConfig = ROLES_CONFIG.find(r => r.id === roleId);
  const roleTitle = roleConfig ? roleConfig.title : 'Ходим';

  const newApplicant = db.createApplicant({
    phone: state.phone,
    full_name: state.fullName,
    role_id: roleId,
    role_title: roleTitle,
    telegram_id: telegramId
  });

  userStates.delete(telegramId);

  await ctx.reply(
    `✅ <b>Аризангиз қабул қилинди!</b>\n\n` +
    `Ходим: <b>${newApplicant.full_name}</b>\n` +
    `Лавозим: <b>${newApplicant.role_title}</b>\n` +
    `Телефон: <b>${newApplicant.phone}</b>\n\n` +
    `Раҳбарият тасдиқлаганидан сўнг сизга хабар берамиз.`,
    { parse_mode: 'HTML' }
  );

  // NOTIFY ALL TOP 3 LEADERS IMMEDIATELY
  const leaders = db.getTop3Leaders();
  for (const ldr of leaders) {
    if (ldr.telegram_id) {
      try {
        await bot.telegram.sendMessage(
          ldr.telegram_id,
          `🔔 <b>ЯНГИ ХОДИМ ҚЎШИЛИШ СЎРОВИ!</b>\n\n` +
          `👤 Исм: <b>${newApplicant.full_name}</b>\n` +
          `🍴 Лавозим: <b>${newApplicant.role_title}</b>\n` +
          `📱 Телефон: <code>${newApplicant.phone}</code>\n\n` +
          `Ушбу ходимни ишга қабул қиласизми?`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ Қабул қилиш', `approve_user_${newApplicant.id}`),
                Markup.button.callback('❌ Рад этиш', `reject_user_${newApplicant.id}`)
              ]
            ])
          }
        );
      } catch (e) {
        console.error(`Could not notify leader ${ldr.id}:`, e.message);
      }
    }
  }
});

// 5. Leader Approves / Rejects Employee
bot.action(/approve_user_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery('Ходим тасдиқланди!');
  const leaderUser = db.getUserByTelegramId(ctx.from.id);
  if (!leaderUser || !isTop3Role(leaderUser.role_id)) {
    return ctx.reply('Бу амални фақат Асосий Учлик бажара олади.');
  }

  const targetUserId = parseInt(ctx.match[1], 10);
  const approvedUser = db.approveApplicant(targetUserId);

  if (!approvedUser) {
    return ctx.editMessageText('Ходим аллақачон тасдиқланган ёки топилмади.');
  }

  await ctx.editMessageText(
    `✅ <b>Ходим қабул қилинди!</b>\n\n` +
    `👤 <b>${approvedUser.full_name}</b> (${approvedUser.role_title})\n` +
    `Тасдиқлади: <b>${leaderUser.full_name}</b>`,
    { parse_mode: 'HTML' }
  );

  // Notify the approved employee in Telegram!
  if (approvedUser.telegram_id) {
    try {
      await bot.telegram.sendMessage(
        approvedUser.telegram_id,
        `🎉 <b>ТАБРИКЛАЙМИЗ!</b>\n\n` +
        `Сизнинг аризангиз раҳбарият томонидан тасдиқланди.\n` +
        `Энди сиз Чархпалак тизимидан тўлиқ фойдалана оласиз!`,
        {
          parse_mode: 'HTML',
          ...getMainMenuKeyboard(approvedUser)
        }
      );
    } catch (e) {
      console.error(e);
    }
  }
});

bot.action(/reject_user_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery('Ариза рад этилди');
  const leaderUser = db.getUserByTelegramId(ctx.from.id);
  if (!leaderUser || !isTop3Role(leaderUser.role_id)) {
    return ctx.reply('Бу амални фақат Асосий Учлик бажара олади.');
  }

  const targetUserId = parseInt(ctx.match[1], 10);
  const rejected = db.rejectApplicant(targetUserId);

  await ctx.editMessageText(
    `❌ <b>Ариза рад этилди.</b>\n` +
    `Ходим: ${rejected?.full_name || ''}\n` +
    `Бажарди: ${leaderUser.full_name}`,
    { parse_mode: 'HTML' }
  );

  if (rejected?.telegram_id) {
    try {
      await bot.telegram.sendMessage(
        rejected.telegram_id,
        `❌ Кечирасиз, сизнинг рўйхатдан ўтиш аризангиз раҳбарият томонидан қабул қилинмади.`
      );
    } catch (e) {}
  }
});

// ---------------- CASH TRANSFER FLOW ----------------

// Step A: "💸 Пул бериш" Button
bot.hears('💸 Пул бериш', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const sender = db.getUserByTelegramId(telegramId);
  if (!sender || !sender.is_active) return ctx.reply('Илтимос, аввал /start ни босинг.');

  const employees = db.getActiveEmployees(sender.id);
  if (employees.length === 0) {
    return ctx.reply('Тизимда бошқа фаол ходимлар топилмади.');
  }

  const buttons = employees.map(emp => [
    Markup.button.callback(`👤 ${emp.full_name} (${emp.role_title})`, `send_to_${emp.id}`)
  ]);

  return ctx.reply(
    `💸 <b>Пулни кимга топширмоқчисиз?</b>\nХодимни танланг:`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    }
  );
});

// Step B: Pick recipient
bot.action(/send_to_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const receiverId = parseInt(ctx.match[1], 10);
  const receiver = db.getUserById(receiverId);

  if (!receiver) return ctx.reply('Ходим топилмади.');

  userStates.set(String(ctx.from.id), {
    step: 'AWAITING_TX_AMOUNT',
    receiverId: receiver.id,
    receiverName: receiver.full_name,
    receiverRole: receiver.role_title
  });

  return ctx.reply(
    `💰 <b>${receiver.full_name}</b> (${receiver.role_title}) га қанча пул бермоқчисиз?\n\n` +
    `Суммани ёзиб юборинг <i>(Масалан: 5000000 ёки 1500000):</i>`,
    { parse_mode: 'HTML' }
  );
});

// Step C: Choose Category
bot.action(/tx_cat_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);
  const state = userStates.get(telegramId);

  if (!state || state.step !== 'AWAITING_TX_CATEGORY') {
    return ctx.reply('Хатолик юз берди. Илтимос, «💸 Пул бериш» тугмасини қайта босинг.');
  }

  const category = ctx.match[1];
  state.category = category;

  const sender = db.getUserByTelegramId(telegramId);
  const amountFormatted = formatMoney(state.amount);

  return ctx.reply(
    `📋 <b>Ўтказма маълумотларини текширинг:</b>\n\n` +
    `👤 Қабул қилувчи: <b>${state.receiverName}</b> (${state.receiverRole})\n` +
    `💰 Сумма: <b>${amountFormatted}</b>\n` +
    `📝 Мақсад: <b>${state.category}</b>\n\n` +
    `Тўловни юборамизми?`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Ҳа, юбориш', 'confirm_tx_send'),
          Markup.button.callback('❌ Бекор қилиш', 'cancel_tx_send')
        ]
      ])
    }
  );
});

// Step D: Confirm and Send Transfer
bot.action('confirm_tx_send', async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);
  const state = userStates.get(telegramId);

  if (!state) return ctx.reply('Ўтказма маълумоти топилмади.');

  const sender = db.getUserByTelegramId(telegramId);
  const receiver = db.getUserById(state.receiverId);

  if (!sender || !receiver) return ctx.reply('Иштирокчилар топилмади.');

  // IMMUTABLE HISTORICAL RECORD CREATION
  const tx = db.createTransaction({
    sender_id: sender.id,
    sender_full_name: sender.full_name,
    sender_role_title: sender.role_title,
    receiver_id: receiver.id,
    receiver_full_name: receiver.full_name,
    receiver_role_title: receiver.role_title,
    amount: state.amount,
    category: state.category,
    comment: ''
  });

  userStates.delete(telegramId);

  await ctx.editMessageText(
    `✅ <b>Пул юборилди!</b>\n\n` +
    `👤 Қабул қилувчи: <b>${receiver.full_name}</b> (${receiver.role_title})\n` +
    `💰 Сумма: <b>${formatMoney(tx.amount)}</b>\n` +
    `Мақсад: <b>${tx.category}</b>\n\n` +
    `⏳ <i>Қабул қилувчи тасдиқлаши кутилмоқда. Тасдиқланганда сизга хабар берамиз.</i>`,
    { parse_mode: 'HTML' }
  );

  // IMMEDIATELY ALERT THE RECIPIENT IN TELEGRAM!
  if (receiver.telegram_id) {
    try {
      await bot.telegram.sendMessage(
        receiver.telegram_id,
        `🔔 <b>ДИҚҚАТ! СИЗГА ПУЛ ТОПШИРИЛДИ!</b>\n\n` +
        `👤 Кимдан: <b>${sender.full_name}</b> (${sender.role_title})\n` +
        `💰 Сумма: <b>${formatMoney(tx.amount)}</b>\n` +
        `📝 Мақсад: <b>${tx.category}</b>\n` +
        `⏰ Вақт: <b>${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</b>\n\n` +
        `Сиз ушбу пулни қабул қилдингизми?`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(`✅ Қабул қилдим (${formatMoney(tx.amount)})`, `tx_ok_${tx.id}`)
            ],
            [
              Markup.button.callback('❌ Рад этиш (Олмадим)', `tx_no_${tx.id}`)
            ]
          ])
        }
      );
    } catch (e) {
      console.error(`Failed to alert receiver ${receiver.id}:`, e.message);
    }
  }
});

bot.action('cancel_tx_send', async (ctx) => {
  await ctx.answerCbQuery('Бекор қилинди');
  userStates.delete(String(ctx.from.id));
  return ctx.editMessageText('❌ Пул бериш бекор қилинди.');
});

// ---------------- RECIPIENT CONFIRMATION & REJECTION ----------------

bot.action(/tx_ok_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery('Тўлов қабул қилинди!');
  const txId = parseInt(ctx.match[1], 10);
  const tx = db.confirmTransaction(txId);

  if (!tx) {
    return ctx.reply('Ушбу тўлов аллақачон тасдиқланган ёки топилмади.');
  }

  await ctx.editMessageText(
    `✅ <b>Сиз тўловни қабул қилдингиз!</b>\n\n` +
    `👤 Кимдан: <b>${tx.sender_full_name}</b> (${tx.sender_role_title})\n` +
    `💰 Сумма: <b>${formatMoney(tx.amount)}</b>\n` +
    `Мақсад: <b>${tx.category}</b>\n` +
    `⏰ Вақт: ${new Date().toLocaleTimeString('uz-UZ')}`,
    { parse_mode: 'HTML' }
  );

  // Notify sender immediately!
  const sender = db.getUserById(tx.sender_id);
  if (sender && sender.telegram_id) {
    try {
      await bot.telegram.sendMessage(
        sender.telegram_id,
        `🎉 <b>ЎТКАЗМА ТАСДИҚЛАНДИ!</b>\n\n` +
        `👤 <b>${tx.receiver_full_name}</b> (${tx.receiver_role_title}) сиз берган <b>${formatMoney(tx.amount)}</b> пулни қабул қилганини тасдиқлади.` +
        (tx.category ? `\nМақсад: ${tx.category}` : ''),
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }
});

bot.action(/tx_no_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const txId = parseInt(ctx.match[1], 10);

  return ctx.reply(
    `❌ <b>Тўловни рад этиш сабабини танланг:</b>`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Нотўғри сумма', `tx_rej_reason_${txId}_sum`)],
        [Markup.button.callback('Менга пул берилмади', `tx_rej_reason_${txId}_notme`)],
        [Markup.button.callback('Бошқа сабаб', `tx_rej_reason_${txId}_other`)]
      ])
    }
  );
});

bot.action(/tx_rej_reason_(\d+)_(.+)/, async (ctx) => {
  await ctx.answerCbQuery('Рад этилди');
  const txId = parseInt(ctx.match[1], 10);
  const reasonCode = ctx.match[2];

  let reasonText = 'Нотўғри сумма';
  if (reasonCode === 'notme') reasonText = 'Пул қўлимга тегмади';
  if (reasonCode === 'other') reasonText = 'Қабул қилувчи рад этди';

  const tx = db.rejectTransaction(txId, reasonText);
  if (!tx) return ctx.reply('Тўлов топилмади.');

  await ctx.editMessageText(
    `❌ <b>Тўлов рад этилди.</b>\n` +
    `Сумма: ${formatMoney(tx.amount)}\n` +
    `Сабаб: ${reasonText}`
  );

  // Notify sender
  const sender = db.getUserById(tx.sender_id);
  if (sender && sender.telegram_id) {
    try {
      await bot.telegram.sendMessage(
        sender.telegram_id,
        `⚠️ <b>ДИҚҚАТ! ТЎЛОВ РАД ЭТИЛДИ!</b>\n\n` +
        `👤 <b>${tx.receiver_full_name}</b> (${tx.receiver_role_title}) сиз юборган <b>${formatMoney(tx.amount)}</b> пулни рад этди.\n` +
        `Сабаб: <i>${reasonText}</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }
});

// ---------------- MENU SECTIONS ----------------

// 1. Pending incoming payments ("📥 Келган тўловлар")
bot.hears('📥 Келган тўловлар', async (ctx) => {
  const user = db.getUserByTelegramId(ctx.from.id);
  if (!user) return ctx.reply('Аввал /start ни босинг.');

  const pendings = db.getPendingIncomingForUser(user.id);
  if (pendings.length === 0) {
    return ctx.reply('✅ Сизда тасдиқланиши кутилаётган тўловлар йўқ.');
  }

  await ctx.reply(`📥 <b>Сизга келган ва тасдиқланиши керак бўлган тўловлар (${pendings.length} та):</b>`, { parse_mode: 'HTML' });

  for (const t of pendings) {
    await ctx.reply(
      `💰 <b>${formatMoney(t.amount)}</b>\n` +
      `Кимдан: <b>${t.sender_full_name}</b> (${t.sender_role_title})\n` +
      `Мақсад: ${t.category}\n` +
      `Вақт: ${new Date(t.created_at).toLocaleTimeString('uz-UZ')}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(`✅ Қабул қилдим`, `tx_ok_${t.id}`),
            Markup.button.callback(`❌ Рад этиш`, `tx_no_${t.id}`)
          ]
        ])
      }
    );
  }
});

// 2. Transaction History ("📜 Ўтказмалар тарихи")
bot.hears('📜 Ўтказмалар тарихи', async (ctx) => {
  const user = db.getUserByTelegramId(ctx.from.id);
  if (!user) return ctx.reply('Аввал /start ни босинг.');

  const isTop3 = isTop3Role(user.role_id);
  const txs = db.getTransactionsForUser(user.id, isTop3, 10);

  if (txs.length === 0) {
    return ctx.reply('Ҳозирча ўтказмалар тарихи мавжуд эмас.');
  }

  let text = `📜 <b>Сўнгги ўтказмалар тарихи:</b>\n\n`;

  txs.forEach((t, i) => {
    const isSender = t.sender_id === user.id;
    const statusIcon = t.status === 'CONFIRMED' ? '✅' : t.status === 'PENDING' ? '⏳' : '❌';
    const direction = isSender ? '↗️ Юборилди' : '↙️ Қабул қилинди';
    const partner = isSender ? `${t.receiver_full_name} (${t.receiver_role_title})` : `${t.sender_full_name} (${t.sender_role_title})`;

    text += `${i + 1}. ${statusIcon} <b>${formatMoney(t.amount)}</b> [${direction}]\n`;
    text += `   👤 Ҳамкор: ${partner}\n`;
    text += `   📝 Мақсад: ${t.category}\n`;
    text += `   ⏰ Сана: ${new Date(t.created_at).toLocaleString('uz-UZ')}\n\n`;
  });

  return ctx.reply(text, { parse_mode: 'HTML' });
});

// 3. User Profile ("👤 Профилим")
bot.hears('👤 Профилим', async (ctx) => {
  const user = db.getUserByTelegramId(ctx.from.id);
  if (!user) return ctx.reply('Аввал /start ни босинг.');

  const stats = db.getStats(user.id, isTop3Role(user.role_id));

  return ctx.reply(
    `👤 <b>Сизнинг профилингиз:</b>\n\n` +
    `Исм-фамилия: <b>${user.full_name}</b>\n` +
    `Лавозим: <b>${user.role_title}</b>\n` +
    `Телефон: <code>${user.phone}</code>\n` +
    `Мақом: ${user.is_active ? '✅ Фаол ходим' : '⏳ Кутилмоқда'}\n\n` +
    `📊 <b>Сизнинг кўрсаткичларингиз:</b>\n` +
    `• Тасдиқланган пуллар: <b>${formatMoney(stats.totalConfirmed)}</b>\n` +
    `• Кутилаётган тўловлар: <b>${formatMoney(stats.totalPending)}</b>`,
    { parse_mode: 'HTML' }
  );
});

// 4. Leadership Business Stats ("📊 Чойхона ҳисоботи")
bot.hears('📊 Чойхона ҳисоботи', async (ctx) => {
  const user = db.getUserByTelegramId(ctx.from.id);
  if (!user || !isTop3Role(user.role_id)) {
    return ctx.reply('Ушбу маълумот фақат Чойхона Раҳбарияти учун кўринади.');
  }

  const stats = db.getStats(null, true);

  return ctx.reply(
    `📊 <b>ЧАРХПАЛАК ЧОЙХОНАСИ МОЛИЯВИЙ ҲИСОБОТИ:</b>\n\n` +
    `📅 <b>Бугунги тасдиқланган айланма:</b>\n` +
    `👉 <b>${formatMoney(stats.todayConfirmed)}</b> (${stats.todayCount} та тўлов)\n\n` +
    `⏳ <b>Ҳозирда кутилаётган (тасдиқланмаган):</b>\n` +
    `👉 <b>${formatMoney(stats.totalPending)}</b> (${stats.pendingCount} та тўлов)\n\n` +
    `📈 <b>Жами тасдиқланган барча тўловлар:</b>\n` +
    `👉 <b>${formatMoney(stats.totalConfirmed)}</b>\n\n` +
    `👥 Фаол ходимлар сони: <b>${stats.activeStaffCount} та</b>\n` +
    `⏳ Кўриб чиқилаётган аризалар: <b>${stats.pendingApplicantsCount} та</b>`,
    { parse_mode: 'HTML' }
  );
});

// 5. Staff Management ("👥 Ходимлар рўйхати")
bot.hears('👥 Ходимлар рўйхати', async (ctx) => {
  const user = db.getUserByTelegramId(ctx.from.id);
  if (!user || !isTop3Role(user.role_id)) {
    return ctx.reply('Фақат раҳбарият учун.');
  }

  const staff = db.getActiveEmployees();
  let text = `👥 <b>Чорхпалак ходимлари рўйхати (${staff.length} та):</b>\n\n`;

  staff.forEach((s, idx) => {
    const isTop = isTop3Role(s.role_id) ? '👑' : '🍴';
    text += `${idx + 1}. ${isTop} <b>${s.full_name}</b> — ${s.role_title} (${s.phone})\n`;
  });

  const pending = db.getPendingApplicants();
  if (pending.length > 0) {
    text += `\n⏳ <b>Тасдиқ кутаётганлар (${pending.length} та):</b>\n`;
    pending.forEach((p, idx) => {
      text += `• ${p.full_name} (${p.role_title}) — ${p.phone}\n`;
    });
  }

  return ctx.reply(text, { parse_mode: 'HTML' });
});

// ---------------- TEXT INPUT HANDLER (STATE MACHINE) ----------------

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const telegramId = String(ctx.from.id);
  const state = userStates.get(telegramId);

  if (!state) return;

  // A. User enters Name
  if (state.step === 'AWAITING_NAME') {
    if (text.length < 3) {
      return ctx.reply('Илтимос, тўлиқ исм ва фамилиянгизни ёзинг:');
    }

    state.fullName = text;
    state.step = 'AWAITING_ROLE';

    const buttons = [];

    // If leadership accounts are not yet bound, offer them in the list
    const unboundLeaders = db.getUnboundLeaders();
    if (unboundLeaders.length > 0) {
      unboundLeaders.forEach(ldr => {
        buttons.push([
          Markup.button.callback(`👑 ${ldr.role_title} (${ldr.full_name})`, `bind_leader_${ldr.id}`)
        ]);
      });
    }

    // Standard Staff roles
    ROLES_CONFIG.forEach(r => {
      buttons.push([
        Markup.button.callback(`${r.icon} ${r.title}`, `role_sel_${r.id}`)
      ]);
    });

    return ctx.reply(
      `Ҳурматли <b>${text}</b>, лавозимингизни танланг:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      }
    );
  }

  // B. Sender enters Amount
  if (state.step === 'AWAITING_TX_AMOUNT') {
    const cleanAmount = parseInt(text.replace(/[^\d]/g, ''), 10);
    if (!cleanAmount || cleanAmount < 1000) {
      return ctx.reply('Илтимос, тўғри сумма киритинг (энг камида 1,000 сўм):');
    }

    state.amount = cleanAmount;
    state.step = 'AWAITING_TX_CATEGORY';

    return ctx.reply(
      `Сумма: <b>${formatMoney(cleanAmount)}</b>\n\n` +
      `Пул нима мақсадда берилмоқда? Тоифани танланг:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Кунлик касса', 'tx_cat_Кунлик касса'),
            Markup.button.callback('Гўшт учун', 'tx_cat_Гўшт учун')
          ],
          [
            Markup.button.callback('Харид / Маҳсулот', 'tx_cat_Харид / Маҳсулот'),
            Markup.button.callback('Маош', 'tx_cat_Маош')
          ],
          [
            Markup.button.callback('Бошқа харажат', 'tx_cat_Бошқа')
          ]
        ])
      }
    );
  }
});

// ---------------- EXPRESS API FOR MINI APP ----------------

app.get('/api/me', (req, res) => {
  const telegramId = req.query.telegram_id;
  const user = db.getUserByTelegramId(telegramId);
  return res.json({ user });
});

app.get('/api/stats', (req, res) => {
  const userId = req.query.user_id;
  const user = db.getUserById(userId);
  const isTop3 = user ? isTop3Role(user.role_id) : false;
  const stats = db.getStats(userId, isTop3);
  return res.json(stats);
});

app.get('/api/employees', (req, res) => {
  const excludeUserId = req.query.exclude_user_id;
  const employees = db.getActiveEmployees(excludeUserId);
  return res.json({ employees });
});

app.get('/api/applicants', (req, res) => {
  const applicants = db.getPendingApplicants();
  return res.json({ applicants });
});

app.post('/api/applicants/:id/approve', (req, res) => {
  const user = db.approveApplicant(req.params.id);
  if (user && user.telegram_id) {
    bot.telegram.sendMessage(
      user.telegram_id,
      `🎉 Сизнинг аризангиз раҳбарият томонидан тасдиқланди! Энди ботдан фойдалана оласиз.`
    ).catch(() => {});
  }
  return res.json({ ok: true, user });
});

app.post('/api/applicants/:id/reject', (req, res) => {
  const removed = db.rejectApplicant(req.params.id);
  return res.json({ ok: true, removed });
});

app.get('/api/transactions', (req, res) => {
  const userId = req.query.user_id;
  const user = db.getUserById(userId);
  const isTop3 = user ? isTop3Role(user.role_id) : false;
  const transactions = db.getTransactionsForUser(userId, isTop3, 50);
  return res.json({ transactions });
});

app.post('/api/transactions', (req, res) => {
  const { sender_id, receiver_id, amount, category, comment } = req.body;
  const sender = db.getUserById(sender_id);
  const receiver = db.getUserById(receiver_id);

  if (!sender || !receiver || !amount) {
    return res.status(400).json({ error: 'Барча майдонларни тўлдиринг' });
  }

  const tx = db.createTransaction({
    sender_id: sender.id,
    sender_full_name: sender.full_name,
    sender_role_title: sender.role_title,
    receiver_id: receiver.id,
    receiver_full_name: receiver.full_name,
    receiver_role_title: receiver.role_title,
    amount: parseInt(amount, 10),
    category: category || 'Бошқа',
    comment: comment || ''
  });

  // Notify receiver via Telegram
  if (receiver.telegram_id) {
    bot.telegram.sendMessage(
      receiver.telegram_id,
      `🔔 <b>ДИҚҚАТ! СИЗГА ПУЛ ТОПШИРИЛДИ!</b>\n\n` +
      `👤 Кимдан: <b>${sender.full_name}</b> (${sender.role_title})\n` +
      `💰 Сумма: <b>${formatMoney(tx.amount)}</b>\n` +
      `📝 Мақсад: <b>${tx.category}</b>\n\n` +
      `Сиз ушбу пулни қабул қилдингизми?`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`✅ Қабул қилдим (${formatMoney(tx.amount)})`, `tx_ok_${tx.id}`)],
          [Markup.button.callback('❌ Рад этиш', `tx_no_${tx.id}`)]
        ])
      }
    ).catch(() => {});
  }

  return res.json({ ok: true, tx });
});

app.post('/api/transactions/:id/confirm', (req, res) => {
  const tx = db.confirmTransaction(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Тўлов топилмади' });

  // Notify sender
  const sender = db.getUserById(tx.sender_id);
  if (sender && sender.telegram_id) {
    bot.telegram.sendMessage(
      sender.telegram_id,
      `🎉 <b>${tx.receiver_full_name}</b> сиз берган <b>${formatMoney(tx.amount)}</b> пулни қабул қилди!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

  return res.json({ ok: true, tx });
});

app.post('/api/transactions/:id/reject', (req, res) => {
  const { reason } = req.body;
  const tx = db.rejectTransaction(req.params.id, reason);
  if (!tx) return res.status(404).json({ error: 'Тўлов топилмади' });

  // Notify sender
  const sender = db.getUserById(tx.sender_id);
  if (sender && sender.telegram_id) {
    bot.telegram.sendMessage(
      sender.telegram_id,
      `⚠️ <b>${tx.receiver_full_name}</b> тўловни рад этди.\nСумма: <b>${formatMoney(tx.amount)}</b>\nСабаб: ${reason || 'Рад этилди'}`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

  return res.json({ ok: true, tx });
});

// Start Express server & Telegram Bot
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Чархпалак веб-сервери ишга тушди: http://0.0.0.0:${PORT}`);
});

bot.launch()
  .then(() => {
    console.log(`🤖 Чархпалак Telegram боти муваффақиятли ишга тушди (@charxpalak_authbot)!`);
  })
  .catch((err) => {
    console.error('Telegram bot launch error:', err.message);
  });

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
