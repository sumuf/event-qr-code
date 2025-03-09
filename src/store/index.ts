import { create } from 'zustand';
import { Event, Attendee, User } from '../types';
import { authenticateUser, registerUser } from '../services/authService';

interface AppState {
  currentUser: User | null;
  events: Event[];
  attendees: Attendee[];
  
  // Auth actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string, role: 'organizer' | 'staff') => Promise<boolean>;
  
  // Event detail actions
  getEventById: (id: string) => Promise<Event | null>;
  getAttendees: (eventId: string) => Promise<Attendee[]>;
  
  // Event actions
  createEvent: (event: Omit<Event, 'id'>) => Promise<Event>;
  getEvents: () => Promise<Event[]>;
  
  // Attendee actions
  addAttendee: (attendee: Omit<Attendee, 'id' | 'qrCode' | 'checkedIn'>) => Promise<Attendee>;
  bulkAddAttendees: (attendees: Omit<Attendee, 'id' | 'qrCode' | 'checkedIn'>[]) => Promise<Attendee[]>;
  checkInAttendee: (qrCode: string) => Promise<{ success: boolean; message: string; attendee?: Attendee }>;
  
  // New action
  deleteEvent: (id: string) => Promise<void>;
  deleteAttendee: (id: string) => Promise<void>;
}

// API URL for backend services - UPDATED to match the URL in config/db.ts
const API_URL = 'https://event-qr-code-production.up.railway.app/api';

// Create the store
const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  events: [],
  attendees: [],
  
  login: async (email, password) => {
    const response = await authenticateUser(email, password);
    if (response.success) {
      if (response.token) {
        localStorage.setItem('authToken', response.token);
      }
      set({ currentUser: response.user });
      return true;
    }
    return false;
  },
  
  logout: () => {
    localStorage.removeItem('authToken');
    set({ currentUser: null });
  },
  
  register: async (name, email, password, role) => {
    const response = await registerUser(name, email, password, role);
    if (response.success) {
      if (response.token) {
        localStorage.setItem('authToken', response.token);
      }
      set({ currentUser: response.user });
      return true;
    }
    return false;
  },
  
  createEvent: async (eventData) => {
    const response = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({
        name: eventData.name,
        description: eventData.description,
        date: eventData.date,
        venue: eventData.venue,
        capacity: eventData.capacity,
        organizer_id: eventData.organizerId
      })
    });
    
    const responseData = await response.json();  // First parse the response
    
    if (!response.ok) {
      throw new Error(responseData.message || 'Failed to create event');
    }

    // Extract the event from the response structure
    const newEvent = responseData.event; 
    
    set(state => ({ events: [...state.events, newEvent] }));
    return newEvent;
  },
  
  getEvents: async () => {
    const response = await fetch(`${API_URL}/events`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    const data = await response.json();
    // Check if the response has the expected structure and contains events array
    const events = data.success && Array.isArray(data.events) ? data.events : [];
    set({ events });
    return events;
  },
  
  addAttendee: async (attendeeData) => {
    const response = await fetch(`${API_URL}/attendees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(attendeeData)
    });
    return await response.json();
  },
  
  bulkAddAttendees: async (attendeesData) => {
    const response = await fetch(`${API_URL}/attendees/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({ attendees: attendeesData })
    });
    return await response.json();
  },
  
  checkInAttendee: async (qrCode) => {
    const response = await fetch(`${API_URL}/attendees/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({ qrCode })
    });
    return await response.json();
  },
  
  deleteEvent: async (id) => {
    await fetch(`${API_URL}/events/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
  },
  
  deleteAttendee: async (id) => {
    await fetch(`${API_URL}/attendees/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
  },

  getEventById: async (id) => {
    if (!id) return null;
    
    try {
      const response = await fetch(`${API_URL}/events/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.event) {
        return data.event;
      }
      return null;
    } catch (error) {
      console.error('Error fetching event:', error);
      return null;
    }
  },

  getAttendees: async (eventId) => {
    const response = await fetch(`${API_URL}/events/${eventId}/attendees`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    const data = await response.json();
    
    // Make sure we're returning the attendees array and that each attendee has the qrCode property
    if (data.success && Array.isArray(data.attendees)) {
      return data.attendees.map((attendee: any) => ({
        ...attendee,
        // Ensure qrCode is available (use existing or generate placeholder if missing)
        qrCode: attendee.qrCode || `${attendee.eventId}-${attendee.id}`
      }));
    }
    
    return [];
  }
}));

// Export the useAppStore hook as default
export default useAppStore;