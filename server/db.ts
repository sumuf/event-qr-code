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

// Database configuration
const pgp = pgPromise({});

// Create a single database connection instance
const db = pgp({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false } // Required for Supabase
});

// Export the database instance
export default db;