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
      rejectUnauthorized: false // This is critical for self-signed certificates
    },
    // Add connection timeout settings
    max: 30, // max number of clients in the pool
    idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 10000, // timeout before a connection attempt is abandoned
  };
} else {
  // For local development, use the Transaction Pooler by default
  console.log('Using Transaction Pooler for local development');
  
  const user = 'postgres.htaoxsultzgbahdqmxfu';
  const host = 'aws-0-ap-south-1.pooler.supabase.com';
  const port = 6543;
  const database = 'postgres';
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
      rejectUnauthorized: false // This is critical for self-signed certificates
    },
    // Add connection timeout settings
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

// Create database instance
const db = pgp(dbConfig);

// Test the connection with more detailed error handling
db.any('SELECT 1')
  .then(() => {
    console.log('Database connection test successful');
  })
  .catch(error => {
    console.error('Database connection test failed:', error);
    
    // Add more detailed error logging based on error code
    if (error.code === 'ETIMEDOUT') {
      console.error('Connection timed out. This might be due to network restrictions or firewall rules.');
      console.error('Try using the Supabase connection pooler instead of direct connection.');
    } else if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.error('SSL certificate validation error. Check your SSL configuration.');
      console.error('Make sure rejectUnauthorized is set to false in your SSL options.');
    }
  });

export default db;