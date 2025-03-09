import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store';
import { Calendar, MapPin, Users, Plus, Trash } from 'lucide-react';
import { format } from 'date-fns';
import { Event } from '../types';
import { toast } from 'react-toastify';

const EventList: React.FC = () => {
  const { currentUser, getEvents, deleteEvent } = useAppStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Fetch events from database
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsData = await getEvents();
        setEvents(eventsData);
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [getEvents]);
  
  // Redirect to login if not authenticated or not an organizer
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (currentUser.role !== 'organizer') {
      navigate('/');
    }
  }, [currentUser, navigate]);
  
  if (!currentUser || currentUser.role !== 'organizer') {
    return null;
  }
  
  if (loading) {
    return <div className="text-center py-10">Loading events...</div>;
  }
  
  // Sort events by date (newest first)
  const sortedEvents = Array.isArray(events) ? [...events].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : [];
  
  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this event?")) {
      await deleteEvent(id);
      // Refresh events after deletion
      const updatedEvents = await getEvents();
      setEvents(updatedEvents);
    }
  };

  return (
    <div>
      <div className="mb-5 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your events and attendees
          </p>
        </div>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <button
            type="button"
            onClick={() => navigate('/events/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            New Event
          </button>
        </div>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {sortedEvents.length > 0 ? (
            sortedEvents.map((event) => (
              <li key={event.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/events/${event.id}`)}>
                  <div className="flex items-center justify-between">
                    <div className="sm:flex sm:items-center">
                      <div className="flex-shrink-0 h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div className="mt-3 sm:mt-0 sm:ml-4">
                        <div className="text-lg font-medium text-indigo-600">{event.name}</div>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          {event.venue}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <div className="flex flex-col items-end">
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(event.date), 'PPP')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(event.date), 'p')}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the onClick for the list item
                          handleDelete(event.id);
                        }}
                        className="ml-4 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <div className="flex items-center text-sm text-gray-500">
                        <Users className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                        <span>Capacity: {event.capacity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-5 text-center text-gray-500">
              No events found. Create your first event!
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default EventList;