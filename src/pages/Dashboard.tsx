import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store';
import { Calendar, Users, QrCode, Ticket, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Event, Attendee } from '../types';

const Dashboard: React.FC = () => {
  const { currentUser, getEvents, getAttendees } = useAppStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Fetch data when component mounts
  useEffect(() => {
    // Modify the fetchData function in the Dashboard component
    const fetchData = async () => {
      try {
        const eventsData = await getEvents();
        setEvents(eventsData);
        
        // Fetch all attendees for all events
        const attendeesData: Attendee[] = [];
        for (const event of eventsData) {
          try {
            const eventAttendees = await getAttendees(event.id);
            // Check if the response is an array
            if (Array.isArray(eventAttendees)) {
              attendeesData.push(...eventAttendees);
            }
          } catch (error) {
            console.warn(`Failed to fetch attendees for event ${event.id}:`, error);
            // Continue with other events even if one fails
          }
        }
        setAttendees(attendeesData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [getEvents, getAttendees]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);
  
  if (!currentUser) {
    return null;
  }

  if (loading) {
    return <div className="text-center py-10">Loading dashboard...</div>;
  }
  
  const upcomingEvents = events
    .filter((event: Event) => new Date(event.date) > new Date())
    .sort((a: Event, b: Event) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const totalAttendees = attendees?.length || 0;
  const checkedInAttendees = attendees?.filter((attendee) => attendee.checkedIn)?.length || 0;
  
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {currentUser.name}</h1>
        <p className="text-gray-600">
          {currentUser.role === 'organizer' ? 'Manage your events and attendees' : 'Scan QR codes to check in attendees'}
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <Calendar className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Events</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{events.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Attendees</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{totalAttendees}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <QrCode className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Checked In</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{checkedInAttendees}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <Ticket className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Check-in Rate</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {totalAttendees > 0 ? Math.round((checkedInAttendees / totalAttendees) * 100) : 0}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Upcoming Events */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Upcoming Events</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => (
              <li key={event.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-indigo-600">{event.name}</div>
                        <div className="text-sm text-gray-500">{event.venue}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-sm text-gray-900">
                        {format(new Date(event.date), 'PPP')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(event.date), 'p')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <div className="flex items-center text-sm text-gray-500">
                        <Users className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                        <span>Capacity: {event.capacity}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <button
                        onClick={() => navigate(`/events/${event.id}`)}
                        className="inline-flex items-center px-3 py-1.5 border border-indigo-600 shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <span>View details</span>
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-5 sm:px-6 text-center text-gray-500">
              No upcoming events
            </li>
          )}
        </ul>
        
        {currentUser.role === 'organizer' && (
          <div className="px-4 py-4 sm:px-6 border-t border-gray-200">
            <button
              onClick={() => navigate('/events/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Create New Event
            </button>
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {currentUser.role === 'organizer' && (
              <>
                <button
                  onClick={() => navigate('/events/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Create New Event
                </button>
                <button
                  onClick={() => navigate('/attendees/import')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Import Attendees
                </button>
              </>
            )}
            
            {currentUser.role === 'staff' && (
              <button
                onClick={() => navigate('/scanner')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Open QR Scanner
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;