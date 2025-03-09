import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import useAppStore from '../store';
import { Event } from '../types';

interface EventFormData {
  name: string;
  date: string;
  venue: string;
  capacity: number;
  description: string;
}

const EventForm: React.FC = () => {
  const { currentUser, events, createEvent } = useAppStore();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const isEditing = !!id;
  const event = isEditing ? events.find(e => e.id === id) : null;
  
  const { register, handleSubmit, formState: { errors } } = useForm<EventFormData>({
    defaultValues: isEditing && event ? {
      name: event.name,
      date: new Date(event.date).toISOString().slice(0, 16), // Format for datetime-local input
      venue: event.venue,
      capacity: event.capacity,
      description: event.description || ''
    } : {
      name: '',
      date: '',
      venue: '',
      capacity: 100,
      description: ''
    }
  });
  
  // Redirect to login if not authenticated or not an organizer
  React.useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (currentUser.role !== 'organizer') {
      navigate('/');
    }
  }, [currentUser, navigate]);
  
  if (!currentUser || currentUser.role !== 'organizer') {
    return null;
  }
  
  const onSubmit = async (data: EventFormData) => {
    try {
      if (isEditing) {
        // In a real app, this would update the event
        alert('Event updated successfully!');
        navigate(`/events/${id}`);
      } else {
        const newEvent = await createEvent({
          ...data,
          organizerId: currentUser.id
        });
        navigate(`/events/${newEvent.id}`);
      }
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };
  
  return (
    <div>
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <div className="px-4 sm:px-0">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {isEditing ? 'Edit Event' : 'Create New Event'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {isEditing 
                ? 'Update the details of your event.' 
                : 'Fill in the details to create a new event.'}
            </p>
          </div>
        </div>
        <div className="mt-5 md:mt-0 md:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 bg-white sm:p-6">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Event Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      {...register('name', { required: 'Event name is required' })}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>
                  
                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                      Date and Time
                    </label>
                    <input
                      type="datetime-local"
                      id="date"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      {...register('date', { required: 'Date and time are required' })}
                    />
                    {errors.date && (
                      <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                    )}
                  </div>
                  
                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="venue" className="block text-sm font-medium text-gray-700">
                      Venue
                    </label>
                    <input
                      type="text"
                      id="venue"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      {...register('venue', { required: 'Venue is required' })}
                    />
                    {errors.venue && (
                      <p className="mt-1 text-sm text-red-600">{errors.venue.message}</p>
                    )}
                  </div>
                  
                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">
                      Capacity
                    </label>
                    <input
                      type="number"
                      id="capacity"
                      min="1"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      {...register('capacity', { 
                        required: 'Capacity is required',
                        min: { value: 1, message: 'Capacity must be at least 1' },
                        valueAsNumber: true
                      })}
                    />
                    {errors.capacity && (
                      <p className="mt-1 text-sm text-red-600">{errors.capacity.message}</p>
                    )}
                  </div>
                  
                  <div className="col-span-6">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      {...register('description')}
                    />
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="button"
                  onClick={() => navigate('/events')}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {isEditing ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EventForm;