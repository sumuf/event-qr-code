import { QRData } from '../types';

// API URL for backend services
const API_URL = 'http://localhost:3001/api';

// Function to verify a token by calling the backend API
export const verifyToken = async (token: string): Promise<{ valid: boolean; data?: QRData; message: string }> => {
  try {
    const response = await fetch(`${API_URL}/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    
    const result = await response.json();
    return {
      valid: result.valid,
      data: result.data,
      message: result.message
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false, message: 'Error verifying token' };
  }
};

// Function to generate a token by calling the backend API
export const generateToken = async (userId: string, eventId: string): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/auth/generate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, eventId }),
    });
    
    const result = await response.json();
    if (result.success) {
      return result.token;
    } else {
      throw new Error(result.message || 'Failed to generate token');
    }
  } catch (error) {
    console.error('Token generation error:', error);
    throw error;
  }
};