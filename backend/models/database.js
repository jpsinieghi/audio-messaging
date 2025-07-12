require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');

console.log('DB Config:', {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database tables
const initDB = async () => {
  try {
    // Check if tables exist first
    const tablesExist = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'audio_messages')
    `);
    
    // Make filename column nullable if table exists
    try {
      await pool.query('ALTER TABLE audio_messages ALTER COLUMN filename DROP NOT NULL');
      console.log('Updated filename column to allow NULL values');
    } catch (alterError) {
      console.log('Filename column already nullable or table does not exist');
    }
    
    // Add moderator_name column if it doesn't exist
    try {
      await pool.query('ALTER TABLE audio_messages ADD COLUMN IF NOT EXISTS moderator_name VARCHAR(50)');
      console.log('Added moderator_name column');
    } catch (alterError) {
      console.log('Moderator_name column already exists or table does not exist');
    }
    
    if (tablesExist.rows.length < 2) {
      console.log('Tables do not exist. Please create them manually or grant CREATE permissions.');
      console.log('Required SQL:');
      console.log(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL
        );
        
        CREATE TABLE audio_messages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          username VARCHAR(50) NOT NULL,
          filename VARCHAR(255),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          responded BOOLEAN DEFAULT FALSE,
          response_filename VARCHAR(255),
          response_timestamp TIMESTAMP,
          text_response TEXT,
          moderator_name VARCHAR(50)
        );
      `);
    }

    // Insert default users if they don't exist
    try {
      const defaultUsers = [
        // Admins
        { username: 'admin', password: 'admin123', role: 'moderator' },
        { username: 'admin2', password: 'admin123', role: 'moderator' },
        { username: 'admin3', password: 'admin123', role: 'moderator' },
        { username: 'admin4', password: 'admin123', role: 'moderator' },
        // Users
        { username: 'user1', password: 'user123', role: 'user' },
        { username: 'user2', password: 'user123', role: 'user' },
        { username: 'user3', password: 'user123', role: 'user' },
        { username: 'user4', password: 'user123', role: 'user' },
        { username: 'user5', password: 'user123', role: 'user' },
        { username: 'user6', password: 'user123', role: 'user' },
        { username: 'user7', password: 'user123', role: 'user' },
        { username: 'user8', password: 'user123', role: 'user' },
        { username: 'user9', password: 'user123', role: 'user' }
      ];

      for (const user of defaultUsers) {
        const userExists = await pool.query('SELECT id FROM users WHERE username = $1', [user.username]);
        if (userExists.rows.length === 0) {
          await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
            [user.username, bcrypt.hashSync(user.password, 10), user.role]
          );
        }
      }
      
      console.log('Database initialized successfully');
    } catch (insertError) {
      console.log('Could not insert default users. Tables may not exist.');
    }
    
  } catch (error) {
    console.error('Database initialization error:', error.message);
    console.log('App will continue but database operations may fail.');
  }
};

module.exports = { pool, initDB };