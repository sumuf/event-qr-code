import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAppStore from '../store';
import { Calendar, MapPin, Users, Clock, Edit, Download, QrCode, Trash, DownloadCloud } from 'lucide-react';
import { format } from 'date-fns';
import QRCode from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Event, Attendee } from '../types';
import { toast } from 'react-toastify';
import JSZip from 'jszip';
import { createRoot } from 'react-dom/client';

const EventDetail: React.FC = () => {
  const { currentUser, deleteAttendee, getEventById, getAttendees } = useAppStore();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [showQRModal, setShowQRModal] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [eventAttendees, setEventAttendees] = useState<Attendee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Filter attendees based on search query
  const filteredAttendees = eventAttendees.filter((attendee: Attendee) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    return (
      attendee.name.toLowerCase().includes(query) ||
      attendee.email.toLowerCase().includes(query)
    );
  });
  
  const checkedInCount = eventAttendees.filter((a: Attendee) => a.checkedIn).length;
  
  const qrCodeRef = useRef<HTMLDivElement | null>(null);

  // Fetch event and attendees data
  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        toast.error('Invalid event ID');
        navigate('/events');
        return;
      }
      
      try {
        setIsLoading(true);
        const eventData = await getEventById(id);
        if (!eventData) {
          toast.error('Event not found');
          navigate('/events');
          return;
        }
        
        const attendeesData = await getAttendees(id);
        setEventAttendees(attendeesData || []);
        setEvent(eventData);
      } catch (error) {
        console.error('Error fetching event data:', error);
        toast.error('Failed to load event details');
        navigate('/events');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [id, getEventById, getAttendees, navigate]);

  const downloadQRCode = async () => {
    if (qrCodeRef.current) {
      // Increase the scale for better quality
      const canvas = await html2canvas(qrCodeRef.current, {
        scale: 3, // Increase scale for higher resolution
        backgroundColor: '#ffffff', // Ensure white background
        logging: false,
        useCORS: true // Enable CORS for any external images
      });
      
      // Use PNG instead of JPEG for better quality with QR codes
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `attendee-qr-code-${showQRModal}.png`;
      link.click();
    }
  };
  
  // Function to download all QR codes as a zip file
  const downloadAllQRCodes = async () => {
    if (!eventAttendees.length) {
      toast.error('No attendees to download QR codes for');
      return;
    }
    
    try {
      setIsBulkDownloading(true);
      toast.info('Preparing QR codes for download...');
      
      // Create a new JSZip instance
      const zip = new JSZip();
      const qrFolder = zip.folder('qr-codes');
      
      if (!qrFolder) {
        throw new Error('Failed to create zip folder');
      }
      
      // Helper function to wait for a specified time
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      // Helper function to render a QR code and capture it
      const renderAndCaptureQRCode = async (attendee: Attendee): Promise<string | null> => {
        if (!attendee.qrCode) return null;
        
        // Create a temporary container for this QR code
        const container = document.createElement('div');
        container.style.padding = '20px';
        container.style.backgroundColor = '#ffffff';
        container.style.border = '1px solid #e5e7eb';
        container.style.borderRadius = '8px';
        container.style.display = 'inline-block';
        container.style.textAlign = 'center';
        document.body.appendChild(container);
        
        try {
          // Create a div for React to render into
          const qrElement = document.createElement('div');
          container.appendChild(qrElement);
          
          // Create a root for the QR code element
          const root = createRoot(qrElement);
          
          // Render the QR code
          root.render(
            <QRCode 
              value={attendee.qrCode} 
              size={200}
              level="H"
              includeMargin={true}
            />
          );
          
          // Add attendee name
          const nameElement = document.createElement('div');
          nameElement.style.marginTop = '10px';
          nameElement.style.fontSize = '14px';
          nameElement.style.color = '#6b7280';
          nameElement.textContent = attendee.name;
          container.appendChild(nameElement);
          
          // Wait for the QR code to render properly
          // This is crucial for ensuring the QR code is fully rendered
          await wait(100);
          
          // Convert to canvas and then to PNG
          const canvas = await html2canvas(container, {
            scale: 3, // Higher scale for better quality
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
          });
          
          // Get PNG data
          return canvas.toDataURL('image/png').split(',')[1];
        } catch (error) {
          console.error(`Error rendering QR code for ${attendee.name}:`, error);
          return null;
        } finally {
          // Clean up - unmount React component and remove container
          if (container.parentNode) {
            document.body.removeChild(container);
          }
        }
      };
      
      // Process each attendee sequentially to avoid rendering issues
      let successCount = 0;
      for (const attendee of eventAttendees) {
        try {
          const imgData = await renderAndCaptureQRCode(attendee);
          
          if (imgData) {
            // Add to zip file - sanitize filename
            const safeFileName = attendee.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            qrFolder.file(`${safeFileName}-${attendee.id}.png`, imgData, {base64: true});
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to process QR code for ${attendee.name}:`, error);
          // Continue with other attendees even if one fails
        }
      }
      
      if (successCount === 0) {
        throw new Error('Failed to generate any QR codes');
      }
      
      // Generate the zip file
      const zipContent = await zip.generateAsync({type: 'blob'});
      
      // Create download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipContent);
      link.download = `${event?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-qr-codes.zip`;
      link.click();
      
      toast.success(`Successfully generated ${successCount} QR codes`);
    } catch (error) {
      console.error('Error generating QR codes zip:', error);
      toast.error('Failed to download QR codes: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsBulkDownloading(false);
    }
  };
  
  const handleDeleteAttendee = async (attendeeId: string) => {
    if (window.confirm("Are you sure you want to delete this attendee?")) {
      await deleteAttendee(attendeeId);
      // Refresh attendees after deletion
      if (id) {
        const updatedAttendees = await getAttendees(id);
        setEventAttendees(updatedAttendees);
      }
    }
  };
  
  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);
  
  if (!currentUser) {
    return null;
  }

  if (isLoading) {
    return <div className="text-center py-10">Loading event details...</div>;
  }
  
  if (!event) {
    return null;
  }
  
  const isOrganizer = currentUser.role === 'organizer';
  
  return (
    <div>
      <div className="mb-5 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {format(new Date(event.date), 'PPPP')} at {format(new Date(event.date), 'p')}
          </p>
        </div>
        {isOrganizer && (
          <div className="mt-3 sm:mt-0 sm:ml-4">
            <button
              type="button"
              onClick={() => navigate(`/events/${id}/edit`)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Edit className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
              Edit Event
            </button>
          </div>
        )}
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Event Details</h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Calendar className="mr-1 h-5 w-5 text-gray-400" />
                Date
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {format(new Date(event.date), 'PPP')}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Clock className="mr-1 h-5 w-5 text-gray-400" />
                Time
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {format(new Date(event.date), 'p')}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <MapPin className="mr-1 h-5 w-5 text-gray-400" />
                Venue
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{event.venue}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Users className="mr-1 h-5 w-5 text-gray-400" />
                Capacity
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{event.capacity}</dd>
            </div>
            {event.description && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900">{event.description}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      
      {/* Event QR Code for Staff */}
      {currentUser.role === 'staff' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Event QR Code</h3>
            <p className="mt-1 text-sm text-gray-500">
              Scan this QR code to check in attendees
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6 flex justify-center">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
              <QRCode 
                value={`https://eventqr.app/events/${event.id}`} 
                size={200}
                level="H"
                includeMargin={true}
              />
              <div className="mt-3 text-center text-sm text-gray-500">
                Event: {event.name}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Attendee Stats */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Attendance</h3>
        </div>
        <div className="border-t border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="bg-gray-50 overflow-hidden shadow-sm rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Registered</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{eventAttendees.length}</dd>
                </div>
              </div>
              <div className="bg-gray-50 overflow-hidden shadow-sm rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">Checked In</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{checkedInCount}</dd>
                </div>
              </div>
              <div className="bg-gray-50 overflow-hidden shadow-sm rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">Check-in Rate</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {eventAttendees.length > 0 ? Math.round((checkedInCount / eventAttendees.length) * 100) : 0}%
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Attendee List - Only for organizers */}
      {isOrganizer && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Attendees</h3>
              <p className="mt-1 text-sm text-gray-500">
                {eventAttendees.length} registered attendees {filteredAttendees.length !== eventAttendees.length && `(${filteredAttendees.length} shown)`}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => navigate(`/attendees/import?eventId=${id}`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Download className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                Import Attendees
              </button>
              {eventAttendees.length > 0 && (
                <button
                  type="button"
                  onClick={downloadAllQRCodes}
                  disabled={isBulkDownloading}
                  className={`inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isBulkDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <DownloadCloud className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                  {isBulkDownloading ? 'Preparing...' : 'Download All QR Codes'}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(`/attendees/new?eventId=${id}`)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Users className="-ml-1 mr-2 h-5 w-5 text-white" />
                Add Attendee
              </button>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="mb-4">
              <label htmlFor="search" className="sr-only">Search attendees</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="search"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="Search by name or email"
                />
              </div>
            </div>
            {eventAttendees.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Checked In Time
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          QR Code
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAttendees.map((attendee: Attendee) => (
                      <tr key={attendee.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {attendee.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {attendee.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {attendee.checkedIn ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Checked In
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              Not Checked In
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {attendee.checkedIn ? 
                            (attendee.checkedInAt ? format(new Date(attendee.checkedInAt), 'PPPpp') : 'N/A') 
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {attendee.qrCode && (
                            <div className="inline-flex items-center">
                              <button
                                type="button"
                                onClick={() => setShowQRModal(attendee.id)}
                                className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                <QrCode className="mr-1 h-4 w-4 text-gray-500" />
                                View QR
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleDeleteAttendee(attendee.id)}
                            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <Trash className="h-4 w-4" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="px-6 py-4 text-center text-sm text-gray-500">
                No attendees registered for this event yet.
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6">
              <div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Attendee QR Code
                  </h3>
                  <div className="mt-4 flex justify-center" ref={qrCodeRef}>
                    {(() => {
                      const attendee = eventAttendees.find(a => a.id === showQRModal);
                      return attendee?.qrCode ? (
                        <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                          <QRCode 
                            value={attendee.qrCode} 
                            size={200}
                            level="H"
                            includeMargin={true}
                          />
                          <div className="mt-3 text-center text-sm text-gray-500">
                            {attendee.name}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">No QR code available</div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                  onClick={() => setShowQRModal(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={downloadQRCode}
                  className="mt-2 inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:text-sm"
                >
                  Download QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetail;