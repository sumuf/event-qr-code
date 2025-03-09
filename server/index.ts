import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import usersRouter from './users';
import db from './db';

// Define the JWT payload type
interface JwtUserPayload {
  userId: string;
  email: string;
  role: string;
}

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());



// Helper function for QR code decryption
const decryptQRCode = (encryptedQRCode: string) => {
  try {
    // Using createDecipheriv instead of deprecated createDecipher
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default_secret_key', 'salt', 32);
    const iv = Buffer.alloc(16, 0); // Initialization vector
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedQRCode, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('QR code decryption error:', error);
    return null;
  }
};

// Helper function for QR code encryption
const generateEncryptedQRCode = (eventId: string, attendeeId: string) => {
  const data = JSON.stringify({
    eventId,
    attendeeId,
    timestamp: Date.now()
  });
  
  // Using createCipheriv instead of deprecated createCipher
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'default_secret_key', 'salt', 32);
  const iv = Buffer.alloc(16, 0); // Initialization vector
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return encrypted;
};

// API root route
app.get('/api', (req, res) => {
  res.json({ message: 'API is working' });
});

// Use the users router
app.use('/api/users', usersRouter);

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.json({ success: false });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false });
  }
});

// Registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, password, and role are required' 
      });
    }

    // Validate role
    const validRoles = ['organizer', 'staff', 'attendee'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role. Must be one of: organizer, staff, attendee' 
      });
    }

    // Check if user already exists
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const newUser = await db.one(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to register user' 
    });
  }
});
// Check-in attendee
app.post('/api/attendees/check-in', async (req, res) => {
  try {
    const { qrCode } = req.body;
    
    if (!qrCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'QR code is required' 
      });
    }
    
    console.log('Received QR code for check-in:', qrCode.substring(0, 20) + '...');
    
    // Decrypt and validate QR code
    const decodedData = decryptQRCode(qrCode);
    
    if (!decodedData) {
      console.error('Failed to decrypt QR code');
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }
    
    if (!decodedData.eventId || !decodedData.attendeeId) {
      console.error('Missing required fields in decoded QR data:', decodedData);
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code content'
      });
    }
    
    // Find attendee by decoded data
    const attendee = await db.oneOrNone('SELECT * FROM attendees WHERE id = $1 AND event_id = $2', 
      [decodedData.attendeeId, decodedData.eventId]);
    
    if (!attendee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Attendee not found' 
      });
    }
    
    // Check if attendee is already checked in
    if (attendee.checked_in) {
      return res.status(400).json({
        success: false,
        message: 'Attendee already checked in',
        attendee: {
          id: attendee.id,
          name: attendee.name,
          email: attendee.email,
          eventId: attendee.event_id,
          qrCode: attendee.qr_code,
          checkedIn: attendee.checked_in,
          checkedInAt: attendee.checked_in_at
        }
      });
    }
    
    // Update check-in status
    const checkedInAt = new Date().toISOString();
    const updatedAttendee = await db.one(
      'UPDATE attendees SET checked_in = true, checked_in_at = $1 WHERE id = $2 RETURNING id, name, email, event_id as "eventId", qr_code as "qrCode", checked_in as "checkedIn", checked_in_at as "checkedInAt"',
      [checkedInAt, attendee.id]
    );
    
    res.json({
      success: true,
      attendee: updatedAttendee
    });
  } catch (error) {
    console.error('Error checking in attendee:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check in attendee' 
    });
  }
});
// Add this after your existing routes

// Get all events
app.get('/api/events', async (req, res) => {
  try {
    // Get user info from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key') as JwtUserPayload;
    
    // Query depends on user role
    let events;
    if (decoded.role === 'organizer') {
      // Organizers see their own events
      events = await db.any(
        'SELECT id, name, description, date, venue, capacity, organizer_id as "organizerId" FROM events WHERE organizer_id = $1 ORDER BY date DESC',
        [decoded.userId]
      );
    } else {
      // Staff see all events
      events = await db.any(
        'SELECT id, name, description, date, venue, capacity, organizer_id as "organizerId" FROM events ORDER BY date DESC'
      );
    }
    
    res.json({ success: true, events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

// Get event by ID
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a valid integer
    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid event ID. Event ID must be a number.' 
      });
    }
    
    const event = await db.oneOrNone(
      'SELECT id, name, description, date, venue, capacity, organizer_id as "organizerId" FROM events WHERE id = $1',
      [eventId]
    );
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    res.json({ success: true, event });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch event' });
  }
});

// Get attendees for an event
app.get('/api/events/:eventId/attendees', async (req, res) => {
  try {
    const { eventId } = req.params;
    const attendees = await db.any(
      'SELECT id, name, email, event_id as "eventId", qr_code as "qrCode", checked_in as "checkedIn", checked_in_at as "checkedInAt" FROM attendees WHERE event_id = $1',
      [eventId]
    );
    
    res.json({ success: true, attendees });
  } catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendees' });
  }
});

// Delete an event
app.delete('/api/events/:id', async (req, res) => {
  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key') as JwtUserPayload;
    
    // Get event ID from URL parameter
    const { id } = req.params;
    const eventId = parseInt(id);
    
    // Check if event exists
    const event = await db.oneOrNone('SELECT * FROM events WHERE id = $1', [eventId]);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    // Only the organizer who created the event or an admin can delete it
    if (decoded.role !== 'admin' && event.organizer_id !== decoded.userId) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this event' });
    }
    
    // Delete the event
    await db.tx(async t => {
      await t.none('DELETE FROM attendees WHERE event_id = $1', [eventId]);
      await t.none('DELETE FROM events WHERE id = $1', [eventId]);
    });
    
    res.json({ success: true, message: 'Event and associated attendees deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event: ' + error.message });
  }
});

// Delete an attendee
app.delete('/api/attendees/:id', async (req, res) => {
  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key') as JwtUserPayload;
    
    // Get attendee ID from URL parameter
    const { id } = req.params;
    
    // Check if attendee exists
    const attendee = await db.oneOrNone('SELECT * FROM attendees WHERE id = $1', [id]);
    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found' });
    }
    
    // Delete the attendee
    await db.none('DELETE FROM attendees WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Attendee deleted successfully' });
  } catch (error) {
    console.error('Error deleting attendee:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attendee' });
  }
});

// Add a new attendee
app.post('/api/attendees', async (req, res) => {
  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key') as JwtUserPayload;
    
    // Extract attendee data from request body
    const { name, email, eventId } = req.body;
    
    if (!name || !email || !eventId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and eventId are required' 
      });
    }
    
    // Generate QR code for the attendee
    // Use a numeric ID instead of UUID if your database expects an integer
    const attendeeId = Math.floor(Math.random() * 1000000000); // Generate a random numeric ID
    const qrCode = generateEncryptedQRCode(eventId, attendeeId.toString());
    
    // Insert attendee into database
    const attendee = await db.one(
      'INSERT INTO attendees (id, name, email, event_id, qr_code, checked_in) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, event_id as "eventId", qr_code as "qrCode", checked_in as "checkedIn", checked_in_at as "checkedInAt"',
      [attendeeId, name, email, eventId, qrCode, false]
    );
    
    res.status(201).json({ success: true, attendee });
  } catch (error) {
    console.error('Error adding attendee:', error);
    res.status(500).json({ success: false, message: 'Failed to add attendee' });
  }
});

// Also update the bulk attendees endpoint
app.post('/api/attendees/bulk', async (req, res) => {
  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key') as JwtUserPayload;
    
    // Extract attendees data from request body
    const { attendees } = req.body;
    
    if (!Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid attendees array is required' 
      });
    }
    
    const results = {
      success: 0,
      errors: [] as string[]
    };
    
    // Process each attendee
    for (const attendee of attendees) {
      try {
        const { name, email, eventId } = attendee;
        
        if (!name || !email || !eventId) {
          results.errors.push(`Invalid data for attendee: ${name || 'unnamed'}`);
          continue;
        }
        
        // Generate a numeric ID instead of UUID
        const attendeeId = Math.floor(Math.random() * 1000000000);
        const qrCode = generateEncryptedQRCode(eventId, attendeeId.toString());
        
        // Insert attendee into database
        await db.one(
          'INSERT INTO attendees (id, name, email, event_id, qr_code, checked_in) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [attendeeId, name, email, eventId, qrCode, false]
        );
        
        results.success++;
      } catch (error) {
        console.error('Error adding bulk attendee:', error);
        results.errors.push(`Failed to add attendee: ${attendee.name || 'unnamed'}`);
      }
    }
    
    res.status(201).json({ 
      success: true, 
      message: `Successfully added ${results.success} attendees with ${results.errors.length} errors`,
      results
    });
  } catch (error) {
    console.error('Error adding bulk attendees:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk attendees' });
  }
});

// Create a new event
app.post('/api/events', async (req, res) => {
  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key') as JwtUserPayload;
    
    // Only organizers can create events
    if (decoded.role !== 'organizer') {
      return res.status(403).json({ success: false, message: 'Only organizers can create events' });
    }
    
    // Extract event data from request body
    const { name, description, date, venue, capacity, organizer_id } = req.body;
    
    if (!name || !date || !venue || !capacity) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, date, venue, and capacity are required' 
      });
    }
    
    // Insert event into database
    const event = await db.one(
      'INSERT INTO events (name, description, date, venue, capacity, organizer_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, description, date, venue, capacity, organizer_id as "organizerId"',
      [name, description, date, venue, capacity, decoded.userId]
    );
    
    res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
});

// Add the rest of your routes here...
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});