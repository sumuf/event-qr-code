import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import useAppStore from '../store';
import { toast } from 'react-toastify';
import Papa from 'papaparse';
import { Event, Attendee } from '../types';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface ImportFormData {
  eventId: string;
  file: FileList;
}

interface RowData {
  name: string;
  email: string;
  // Add other fields as necessary
}

const downloadSampleCSV = () => {
  // Create sample CSV content
  const csvContent = 'name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com';
  
  // Create a Blob with the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Create a URL for the Blob
  const url = URL.createObjectURL(blob);
  
  // Create a temporary link element
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'attendees_template.csv');
  
  // Append the link to the body
  document.body.appendChild(link);
  
  // Trigger the download
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const AttendeeImport: React.FC = () => {
  const { currentUser, bulkAddAttendees, getEvents } = useAppStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const eventIdParam = queryParams.get('eventId');
  
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{ total: number; success: number; errors: string[] }>({
    total: 0,
    success: 0,
    errors: []
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
  
  const { register, handleSubmit, formState: { errors: formErrors }, watch } = useForm<ImportFormData>({
    defaultValues: {
      eventId: eventIdParam || ''
    }
  });
  
  const selectedFile = watch('file');
  const selectedEventId = watch('eventId');
  const selectedEvent = events.find(e => e.id === selectedEventId);
  
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
  
  // File upload is handled by react-hook-form and processed in onSubmit

  const onSubmit = async (data: ImportFormData) => {
    if (!data.file || data.file.length === 0) {
      return;
    }
    
    setImportStatus('processing');
    
    const file = data.file[0];
    
    Papa.parse<RowData>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const { data: parsedData, errors: parseErrors } = results;
          
          if (parseErrors.length > 0) {
            setImportStatus('error');
            setImportResult({
              total: parsedData.length,
              success: 0,
              errors: parseErrors.map(e => `Row ${e.row}: ${e.message}`)
            });
            return;
          }
          
          // Validate and transform the data
          const validAttendees: Attendee[] = [];
          const errorMessages: string[] = [];
          
          for (let i = 0; i < parsedData.length; i++) {
            const row: RowData = parsedData[i];
            const rowNum = i + 2; // +2 because of 0-indexing and header row
            
            if (!row.name) {
              errorMessages.push(`Row ${rowNum}: Missing name`);
              continue;
            }
            
            if (!row.email) {
              errorMessages.push(`Row ${rowNum}: Missing email`);
              continue;
            }
            
            // Basic email validation
            const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
            if (!emailRegex.test(row.email)) {
              errorMessages.push(`Row ${rowNum}: Invalid email format`);
              continue;
            }
            
            validAttendees.push({
              id: `attendee-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate a unique ID
              name: row.name,
              email: row.email,
              eventId: selectedEventId, // Ensure this is defined
              checkedIn: false // Default value
            });
          }
          
          if (validAttendees.length === 0) {
            setImportStatus('error');
            setImportResult({
              total: parsedData.length,
              success: 0,
              errors: errorMessages.length > 0 ? errorMessages : ['No valid attendees found in the file']
            });
            return;
          }
          
          // Add the attendees
          const newAttendees = await bulkAddAttendees(
            validAttendees // Now validAttendees already has the correct structure
          );
          
          setImportStatus('success');
          setImportResult({
            total: parsedData.length,
            success: newAttendees.length,
            errors: errorMessages
          });
        } catch (error) {
          console.error('Import error:', error);
          setImportStatus('error');
          setImportResult({
            total: 0,
            success: 0,
            errors: ['An unexpected error occurred during import']
          });
        }
      },
      error: (error) => {
        console.error('Parse error:', error);
        setImportStatus('error');
        setImportResult({
          total: 0,
          success: 0,
          errors: ['Failed to parse the CSV file']
        });
      }
    });
  };
  
  return (
    <div>
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <div className="px-4 sm:px-0">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Import Attendees</h3>
            <p className="mt-1 text-sm text-gray-600">
              Upload a CSV file with attendee information to bulk import attendees.
            </p>
            <div className="mt-4 border border-gray-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-gray-900">CSV Format</h4>
              <p className="mt-1 text-xs text-gray-500">
                Your CSV file should have the following columns:
              </p>
              <ul className="mt-2 text-xs text-gray-500 list-disc list-inside">
                <li>name (required)</li>
                <li>email (required)</li>
              </ul>
              <div className="mt-3 text-xs">
                <p className="font-medium text-gray-900">Example:</p>
                <pre className="mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                  name,email<br />
                  John Doe,john@example.com<br />
                  Jane Smith,jane@example.com
                </pre>
              </div>
              <button
                type="button"
                onClick={downloadSampleCSV}
                className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Download Sample CSV
              </button>
            </div>
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
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name} ({new Date(event.date).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                    {formErrors.eventId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.eventId.message}</p>
                    )}
                  </div>
                  
                  <div className="col-span-6">
                    <label className="block text-sm font-medium text-gray-700">
                      Attendee CSV File
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="file"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                          >
                            <span>Upload a file</span>
                            <input
                              id="file"
                              type="file"
                              className="sr-only"
                              accept=".csv"
                              {...register('file', { required: 'Please select a CSV file' })}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">CSV file up to 10MB</p>
                      </div>
                    </div>
                    {selectedFile && selectedFile.length > 0 && (
                      <p className="mt-2 text-sm text-gray-500">
                        Selected file: {selectedFile[0].name}
                      </p>
                    )}
                    {formErrors.file && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.file.message}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {importStatus === 'success' && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4 mx-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Import successful</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>Successfully imported {importResult.success} of {importResult.total} attendees.</p>
                        {importResult.errors.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium">Errors:</p>
                            <ul className="list-disc list-inside">
                              {importResult.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {importStatus === 'error' && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 mx-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Import failed</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>Failed to import attendees.</p>
                        {importResult.errors.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium">Errors:</p>
                            <ul className="list-disc list-inside">
                              {importResult.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="button"
                  onClick={() => selectedEvent ? navigate(`/events/${selectedEvent.id}`) : navigate('/events')}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importStatus === 'processing'}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {importStatus === 'processing' ? 'Importing...' : 'Import Attendees'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AttendeeImport;