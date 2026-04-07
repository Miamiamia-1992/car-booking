import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/car-booking.db');

let db;

export async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      plate TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      visitor_name TEXT NOT NULL,
      visitor_phone TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

  const adminExists = db.exec("SELECT id FROM users WHERE username = 'admin'");
  if (adminExists.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', ['admin', hashedPassword, '管理员', 'admin']);
  }

  const vehicleCount = db.exec('SELECT COUNT(*) as count FROM vehicles');
  if (vehicleCount[0]?.values[0][0] === 0) {
    const vehicles = [
      ['白色大通（油车）', '京MGW855'],
      ['长安汽车（新能源）', '京ABN2758'],
      ['红旗汽车（油车仅所领导使用）', '京N3FD76'],
    ];
    vehicles.forEach(v => {
      db.run('INSERT INTO vehicles (name, plate) VALUES (?, ?)', v);
    });
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS vehicle_unavailable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

  saveDatabase();
  console.log('Database initialized');
  return db;
}

export function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, buffer);
}

export function getDb() {
  return db;
}

export default {
  prepare: (sql) => ({
    run: (...params) => {
      db.run(sql, params);
      saveDatabase();
      return { lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] };
    },
    get: (...params) => {
      const result = db.exec(sql, params);
      if (result.length === 0 || result[0].values.length === 0) return undefined;
      const columns = result[0].columns;
      const values = result[0].values[0];
      const obj = {};
      columns.forEach((col, i) => obj[col] = values[i]);
      return obj;
    },
    all: (...params) => {
      const result = db.exec(sql, params);
      if (result.length === 0) return [];
      const columns = result[0].columns;
      return result[0].values.map(values => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = values[i]);
        return obj;
      });
    }
  })
};