import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db = null;

export const initDB = async () => {
  if (db) return db;
  db = await sqlite.createConnection("temple_db_v1", false, "no-encryption", 1, false);
  await db.open();
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_date TEXT,
      book_type INTEGER,
      amount INTEGER,
      narration TEXT,
      receipt_no TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
};

export const getDB = () => {
  if (!db) throw new Error("DB Not Ready");
  return db;
};