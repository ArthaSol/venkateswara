import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);

export const initDB = async () => {
  try {
    const db = await sqlite.createConnection('temple_db', false, 'no-encryption', 1, false);
    await db.open();
    
    // Create the Table if it doesn't exist
    const schema = `
      CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        donor_name TEXT,
        amount REAL,
        type TEXT DEFAULT 'CREDIT',
        remarks TEXT
      );
    `;
    await db.execute(schema);
    return db;
  } catch (err) {
    console.log("Database already open or error:", err);
    return sqlite.retrieveConnection('temple_db', false);
  }
};

export const getDB = async () => {
  return sqlite.retrieveConnection('temple_db', false);
};

// ... (keep existing initDB and getDB code) ...

export const getAllDonations = async () => {
  const db = await getDB();
  // Get all entries, ordered by newest first
  const res = await db.query("SELECT * FROM donations ORDER BY id DESC");
  return res.values || [];
};

export const deleteDonation = async (id) => {
  const db = await getDB();
  await db.run("DELETE FROM donations WHERE id = ?", [id]);
};
