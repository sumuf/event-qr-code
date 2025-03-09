import { User } from '../types';

// API URL for backend services


const API_URL = 'http://localhost:3001/api'; // Update this with your API server URL

export const authService = {
  async login(email: string, password: string) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      return await response.json();
    } catch (error) {
      console.error('Login error:', error);
      return { success: false };
    }
  },

  async register(name: string, email: string, password: string, role: string) {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, role }),
      });
      return await response.json();
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false };
    }
  }
};
export default authService;