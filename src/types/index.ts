export interface User {
  id: string;
  name: string;
  email: string;
  role: 'organizer' | 'attendee' | 'staff';
}

export interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  capacity: number;
  description?: string;
  organizerId: string;
}

export interface Attendee {
  id: string;
  name: string;
  email: string;
  eventId: string;
  qrCode?: string;
  checkedIn: boolean;
  checkedInAt?: string;
}

export interface QRData {
  userId: string;
  eventId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ScanResult {
  valid: boolean;
  message: string;
  attendee?: Attendee;
}