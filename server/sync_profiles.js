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

async function syncProfiles() {
  try {
    console.log('Synchronizing profiles for existing staff members...');
    
    // Find users who don't have a profile
    const usersWithoutProfiles = await pool.query(`
      SELECT u.id, u.email, u.full_name, r.role
      FROM public.app_users u
      JOIN public.user_roles r ON u.id = r.user_id
      LEFT JOIN public.profiles p ON u.id = p.user_id
      WHERE p.id IS NULL AND u.email != ''
    `);

    console.log(`Found ${usersWithoutProfiles.rows.length} users missing profiles.`);

    for (const user of usersWithoutProfiles.rows) {
      console.log(`Creating profile for ${user.email}...`);
      try {
        await pool.query(
          'INSERT INTO public.profiles (user_id, full_name, email) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING',
          [user.id, user.full_name, user.email]
        );
        console.log(`Successfully restored profile for ${user.email}`);
      } catch (err) {
        console.error(`Failed to restore profile for ${user.email}:`, err.message);
      }
    }

    console.log('Synchronization complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error during synchronization:', err.message);
    process.exit(1);
  }
}

syncProfiles();
