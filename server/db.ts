import pgPromise from 'pg-promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get directory name equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // Read the Supabase CA certificate
  let caCert;
  try {
    // Try to read the certificate file
    const certPath = path.join(__dirname, '../certs/supabase.crt');
    console.log('Looking for certificate at:', certPath);
    caCert = fs.readFileSync(certPath).toString();
    console.log('Certificate loaded successfully');
  } catch (certError) {
    console.error('Failed to load certificate:', certError);
    
    // Fallback: Try to use the certificate content directly
    console.log('Attempting to use hardcoded certificate...');
    try {
      // Read from the known location in the project
      caCert = fs.readFileSync(path.join(process.cwd(), 'certs/supabase.crt')).toString();
      console.log('Certificate loaded from project root');
    } catch (fallbackError) {
      console.error('Fallback certificate loading failed:', fallbackError);
      caCert = null;
    }
  }

  // Check if DATABASE_URL is provided (Railway deployment)
  if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL for connection');
    
    // Parse the connection string to extract components
    const connectionString = process.env.DATABASE_URL;
    console.log('Connection string format check:', connectionString.substring(0, 20) + '...');
    
    // Configure SSL options based on certificate availability
    const sslConfig = caCert 
      ? { 
          ca: caCert,
          rejectUnauthorized: true  // Enforce certificate validation
        }
      : { 
          rejectUnauthorized: false // Fallback if certificate is not available
        };
    
    console.log('SSL configuration:', caCert ? 'Using certificate' : 'Using fallback (not recommended for production)');
    
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig
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
    
    // Configure SSL options based on certificate availability
    const sslConfig = caCert 
      ? { 
          ca: caCert,
          rejectUnauthorized: true  // Enforce certificate validation
        }
      : { 
          rejectUnauthorized: false // Fallback if certificate is not available
        };
    
    db = pgp({
      host,
      port,
      database,
      user,
      password,
      ssl: sslConfig
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
        console.error('Verify that the Supabase certificate is correctly loaded.');
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