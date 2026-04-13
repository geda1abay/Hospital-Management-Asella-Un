import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkStaff() {
  try {
    console.log('Checking database for staff members...');
    
    const users = await pool.query('SELECT id, email, full_name FROM public.app_users');
    console.log('--- app_users ---');
    console.table(users.rows);

    const roles = await pool.query('SELECT * FROM public.user_roles');
    console.log('--- user_roles ---');
    console.table(roles.rows);

    const profiles = await pool.query('SELECT * FROM public.profiles');
    console.log('--- profiles ---');
    console.table(profiles.rows);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkStaff();
