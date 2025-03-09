import { User } from '../types';
import { authService } from '../config/db';

// JWT secret should be handled on the server side
const JWT_SECRET = 'default_secret_key';

export async function authenticateUser(email: string, password: string): Promise<{ success: boolean; user?: User; token?: string }> {
  return await authService.login(email, password);
}

export async function registerUser(name: string, email: string, password: string, role: 'organizer' | 'attendee' | 'staff'): Promise<{ success: boolean; user?: User; token?: string }> {
  return await authService.register(name, email, password, role);
}