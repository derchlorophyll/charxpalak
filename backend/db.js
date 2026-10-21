import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, 'charxpalak.db');
const db = new Database(dbPath);

// Enable WAL mode
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_title TEXT NOT NULL,
    pin_code TEXT,
    is_active INTEGER DEFAULT 1,
    telegram_chat_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    sender_full_name TEXT NOT NULL,
    sender_role_title TEXT NOT NULL,
    receiver_id INTEGER NOT NULL,
    receiver_full_name TEXT NOT NULL,
    receiver_role_title TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT DEFAULT 'Бошқа',
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reject_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Add pin_code column if table existed previously without it
try {
  db.exec('ALTER TABLE users ADD COLUMN pin_code TEXT');
} catch (e) {
  // Column already exists
}

// Reset and seed real leadership team in Uzbek Cyrillic
export function initializeRealData() {
  db.exec(`
    DELETE FROM transactions;
    DELETE FROM users;
    DELETE FROM otp_codes;
  `);

  const insertUser = db.prepare(`
    INSERT INTO users (id, phone, full_name, role_id, role_title, pin_code, is_active)
    VALUES (?, ?, ?, ?, ?, NULL, 1)
  `);

  // 1. Владелец: Каюмов Жамшидбек (Мулкдор / Эга)
  // 2. Руководитель работ: Басиржонов Жавлонбек (Иш бошқарувчи / РР)
  // 3. Управляющий делами: Паҳлавон (Иш юритувчи / УД)
  insertUser.run(1, '+998900000001', 'Каюмов Жамшидбек', 'OWNER', 'Мулкдор (Эга)');
  insertUser.run(2, '+998900000002', 'Басиржонов Жавлонбек', 'SUPERVISOR', 'Иш бошқарувчи (РР)');
  insertUser.run(3, '+998900000003', 'Паҳлавон', 'MANAGER', 'Иш юритувчи (УД)');

  const insertSetting = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  insertSetting.run('RESTAURANT_NAME', 'Чархпалак Чойхонаси');
  insertSetting.run('THEME_COLOR', 'BLUE');
  insertSetting.run('TELEGRAM_BOT_TOKEN', '8864236616:AAFhhyZay4tnhiQlVrjX5S7BftiUCH-tOcQ');
  insertSetting.run('TELEGRAM_BOT_USERNAME', 'charxpalak_authbot');
  insertSetting.run('SMS_PROVIDER', 'TELEGRAM');
  insertSetting.run('LEADER_SETUP_KEY', '7777');
}

// Always ensure the official Telegram bot token and settings are updated in DB
const tokenSetting = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
tokenSetting.run('TELEGRAM_BOT_TOKEN', '8864236616:AAFhhyZay4tnhiQlVrjX5S7BftiUCH-tOcQ');
tokenSetting.run('TELEGRAM_BOT_USERNAME', 'charxpalak_authbot');
tokenSetting.run('SMS_PROVIDER', 'TELEGRAM');

const initSetting = db.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)');
initSetting.run('LEADER_SETUP_KEY', '7777');

// Check if leaders exist
const leaderCount = db.prepare('SELECT count(*) as count FROM users').get().count;
if (leaderCount === 0) {
  initializeRealData();
}

export default db;
