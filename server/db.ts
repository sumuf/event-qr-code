import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

dotenv.config();

// Log the database connection details (without the password)
console.log('Attempting to connect to database:');
console.log(`Host: ${process.env.DB_HOST || 'not set'}`);
console.log(`Port: ${process.env.DB_PORT || 'not set'}`);
console.log(`Database: ${process.env.DB_NAME || 'not set'}`);
console.log(`User: ${process.env.DB_USER || 'not set'}`);
console.log(`SSL: Enabled`);

// Database configuration with explicit error handling
const pgp = pgPromise({
  connect(client) {
    console.log('Connected to database successfully');
  },
  error(err, e) {
    console.error('Database connection error:', err);
    console.error('Connection details:', e.cn);
  }
});

// Use hardcoded values as fallback if environment variables are not available
const db = pgp({
  host: process.env.DB_HOST || 'htaoxsultzgbahdqmxfu.supabase.co',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'default_password', // Replace with a default for testing
  ssl: { rejectUnauthorized: false } // Required for Supabase
});

// Test the connection explicitly
db.connect()
  .then(obj => {
    console.log('Database connection test successful');
    obj.done(); // success, release the connection
  })
  .catch(error => {
    console.error('Database connection test failed:', error.message || error);
  });

// Export the database instance
export default db;