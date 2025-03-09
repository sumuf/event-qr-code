import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

dotenv.config();

// Log connection attempt
console.log('Attempting to connect to database...');

// Database configuration with explicit error handling
const pgp = pgPromise({
  connect(client) {
    console.log('Connected to database successfully');
  },
  error(err, e) {
    console.error('Database connection error:', err);
    if (e && e.cn) {
      console.error('Connection details:', {
        host: e.cn.host,
        port: e.cn.port,
        database: e.cn.database,
        user: e.cn.user
      });
    }
  }
});

// Connection configuration
let dbConfig;

// Check if DATABASE_URL is provided (Railway deployment)
if (process.env.DATABASE_URL) {
  console.log('Using DATABASE_URL for connection');
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Supabase connections
    }
  };
} else {
  // Fallback to individual connection parameters
  console.log('Using individual connection parameters');
  
  // Use hardcoded Supabase values as fallback
  const host = process.env.DB_HOST || 'htaoxsultzgbahdqmxfu.supabase.co';
  const port = parseInt(process.env.DB_PORT || '5432');
  const database = process.env.DB_NAME || 'postgres';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD;
  
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Database: ${database}`);
  console.log(`User: ${user}`);
  
  dbConfig = {
    host,
    port,
    database,
    user,
    password,
    ssl: {
      rejectUnauthorized: false
    }
  };
}

// Create database instance
const db = pgp(dbConfig);

// Test the connection
db.any('SELECT 1')
  .then(() => {
    console.log('Database connection test successful');
  })
  .catch(error => {
    console.error('Database connection test failed:', error);
  });

export default db;