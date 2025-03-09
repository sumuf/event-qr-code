import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import useAppStore from '../store';
import { toast } from 'react-toastify';
import { Event } from '../types';

interface AttendeeFormData {
  name: string;
  email: string;
  eventId: string;
}

const AttendeeForm: React.FC = () => {
  const { currentUser, addAttendee, getEvents } = useAppStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const eventIdParam = queryParams.get('eventId');
  
  const { register, handleSubmit, formState: { errors } } = useForm<AttendeeFormData>({
    defaultValues: {
      eventId: eventIdParam || ''
    }
  });
  
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
  
  const onSubmit = async (data: AttendeeFormData) => {
    try {
      await addAttendee({
        name: data.name,
        email: data.email,
        eventId: data.eventId
      });
      
      toast.success('Attendee added successfully!');
      navigate(`/events/${data.eventId}`);
    } catch (error) {
      console.error('Error adding attendee:', error);
      toast.error('Failed to add attendee');
    }
  };
  
  return (
    <div>
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <div className="px-4 sm:px-0">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Add Attendee</h3>
            <p className="mt-1 text-sm text-gray-600">
              Add a new attendee to your event. They will receive a QR code for check-in.
            </p>
          </div>
        </div>
        <div className="mt-5 md:mt-0 md:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 bg-white sm:p-6">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6">
                    <label htmlFor="eventId" className="block text-sm font-medium text-gray-700">
                      Event
                    </label>
                    <select
                      id="eventId"
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      {...register('eventId', { required: 'Please select an event' })}
                    >
                      <option value="">Select an event</option>
                      {events.map((event: Event) => (
                        <option key={event.id} value={event.id}>
                          {event.name} ({new Date(event.date).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                    {errors.eventId && (
                      <p className="mt-1 text-sm text-red-600">{errors.eventId.message}</p>
                    )}
                  </div>
                  
                  <div className="col-span-6">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      {...register('name', { required: 'Name is required' })}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>
                  
                  <div className="col-span-6">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      {...register('email', { 
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        }
                      })}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="button"
                  onClick={() => navigate(eventIdParam ? `/events/${eventIdParam}` : '/events')}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Add Attendee
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AttendeeForm;