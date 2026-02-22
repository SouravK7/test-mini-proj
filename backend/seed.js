/**
 * Database Seed Script
 * Run this after setting up the database schema to insert proper hashed passwords
 * Usage: node seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('./config/database');

async function seed() {
    try {
        console.log('🌱 Seeding database...');

        // Hash passwords
        const adminHash = await bcrypt.hash('admin123', 10);
        const facultyHash = await bcrypt.hash('faculty123', 10);
        const userHash = await bcrypt.hash('user123', 10);
        const publicHash = await bcrypt.hash('public123', 10);

        // Update users with proper password hashes
        await query(`
      UPDATE users SET password_hash = $1 WHERE email = 'admin@coet.edu'
    `, [adminHash]);

        await query(`
      UPDATE users SET password_hash = $1 WHERE email = 'faculty@coet.edu'
    `, [facultyHash]);

        await query(`
      UPDATE users SET password_hash = $1 WHERE email = 'user@coet.edu'
    `, [userHash]);

        await query(`
      UPDATE users SET password_hash = $1 WHERE email = 'public@gmail.com'
    `, [publicHash]);

        console.log('✅ Passwords updated successfully');
        console.log('\n📋 Demo Credentials:');
        console.log('   Admin: admin@coet.edu / admin123');
        console.log('   Faculty: faculty@coet.edu / faculty123');
        console.log('   User: user@coet.edu / user123');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error);
        await pool.end();
        process.exit(1);
    }
}

seed();
