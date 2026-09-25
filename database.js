// database.js
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const poolConfig = CONFIG.postgres.connectionString
  ? {
      connectionString: CONFIG.postgres.connectionString,
      ssl: CONFIG.postgres.ssl
    }
  : {
      host: CONFIG.postgres.host,
      port: CONFIG.postgres.port,
      database: CONFIG.postgres.database,
      user: CONFIG.postgres.user,
      password: CONFIG.postgres.password
    };

export const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('Error en el pool de PostgreSQL:', err);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export const get = async (text, params) => (await query(text, params)).rows[0];
export const all = async (text, params) => (await query(text, params)).rows;
export const run = async (text, params) => {
  const res = await query(text, params);
  return { rowCount: res.rowCount, rows: res.rows };
};

export async function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  try {
    await pool.query(schema);
    console.log('Esquema de PostgreSQL inicializado');
  } catch (err) {
    console.error('Error inicializando esquema:', err.message);
    throw err;
  }
}

export async function closePool() {
  await pool.end();
}
