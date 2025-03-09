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
let db;

try {
  // Check if DATABASE_URL is provided (Railway deployment)
  if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL for connection');
    
    // Parse the connection string to extract components
    const connectionString = process.env.DATABASE_URL;
    console.log('Connection string format check:', connectionString.substring(0, 20) + '...');
    
    // Try a simpler connection approach
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
    
    db = pgp(config);
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
    
    db = pgp({
      host,
      port,
      database,
      user,
      password,
      ssl: { rejectUnauthorized: false }
    });
  }

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
      } else if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        console.error('SSL certificate validation error. Check your SSL configuration.');
      } else if (error.message && error.message.includes('SASL')) {
        console.error('SASL authentication error. This might be due to incorrect credentials or connection string format.');
        console.error('Try using a different connection string format or check your credentials.');
      }
    });
} catch (initError) {
  console.error('Database initialization error:', initError);
  // Create a dummy db object that will throw errors when used
  db = pgp({ host: 'localhost' });
}

export default db;