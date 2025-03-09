import db from './dbConnection';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

// Get directory name equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  try {
    // Read and execute schema SQL
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await db.none(schemaSQL);
    
    console.log('Database schema created successfully');
    
    // Check if users exist, if not create demo users
    const userCount = await db.one('SELECT COUNT(*) FROM users', [], (data) => +data.count);
    
    if (userCount === 0) {
      // Create demo users
      const hashedPassword = await bcrypt.hash('password', 10);
      
      await db.tx(async t => {
        await t.batch([
          t.none(`
            INSERT INTO users (name, email, password, role)
            VALUES ($1, $2, $3, $4)
          `, ['John Organizer', 'organizer@example.com', hashedPassword, 'organizer']),
          
          t.none(`
            INSERT INTO users (name, email, password, role)
            VALUES ($1, $2, $3, $4)
          `, ['Sarah Staff', 'staff@example.com', hashedPassword, 'staff'])
        ]);
      });
      
      console.log('Demo users created successfully');
    }
    
    console.log('Database setup completed');
  } catch (error) {
    console.error('Database setup failed:', error);
  } finally {
    // Close the database connection
    db.$pool.end();
  }
}

setupDatabase();