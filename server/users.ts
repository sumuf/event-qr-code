import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db';

// Define the JWT payload type
interface JwtUserPayload {
  userId: string;
  email: string;
  role: string;
}

// Middleware to verify JWT token
const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key') as JwtUserPayload;
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Create router
const router = express.Router();

// Get all users (only for organizers)
router.get('/', verifyToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Only organizers can view all users
    if (user.role !== 'organizer') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const users = await db.any(
      'SELECT id, name, email, role, created_at as "createdAt" FROM users ORDER BY created_at DESC'
    );
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.oneOrNone(
      'SELECT id, name, email, role, created_at as "createdAt" FROM users WHERE id = $1',
      [id]
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

// Update user
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;
    const currentUser = (req as any).user;
    
    // Only organizers can update users
    if (currentUser.role !== 'organizer') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Check if user exists
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update user
    const updatedUser = await db.one(
      'UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4 RETURNING id, name, email, role, created_at as "createdAt"',
      [name, email, role, id]
    );
    
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;
    
    // Only organizers can delete users
    if (currentUser.role !== 'organizer') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Check if user exists
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Delete user
    await db.none('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Verify/unverify user
router.put('/:id/verify', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    const currentUser = (req as any).user;
    
    // Only organizers can verify users
    if (currentUser.role !== 'organizer') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Check if user exists
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update verification status
    const updatedUser = await db.one(
      'UPDATE users SET verified = $1 WHERE id = $2 RETURNING id, name, email, role, created_at as "createdAt", verified',
      [verified, id]
    );
    
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user verification:', error);
    res.status(500).json({ success: false, message: 'Failed to update user verification' });
  }
});

// Remove the verify/unverify user endpoint since the verified column doesn't exist

export default router;