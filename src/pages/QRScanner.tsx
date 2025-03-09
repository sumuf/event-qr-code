import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store'; // Fixed: Changed from import { useAppStore } to import useAppStore
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle, XCircle, Camera, CameraOff } from 'lucide-react';
import jsQR from 'jsqr'; // Ensure this import is correct

// Helper function to apply sharpening filter to image data
const applySharpen = (imageData: ImageData, kernel: number[], width: number, height: number): ImageData => {
  const output = new ImageData(width, height);
  const data = imageData.data;
  const outputData = output.data;
  
  // Apply convolution for each pixel
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const offset = (y * width + x) * 4;
      
      // For each color channel (R, G, B)
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        
        // Apply kernel
        sum += data[(y - 1) * width * 4 + (x - 1) * 4 + c] * kernel[0];
        sum += data[(y - 1) * width * 4 + x * 4 + c] * kernel[1];
        sum += data[(y - 1) * width * 4 + (x + 1) * 4 + c] * kernel[2];
        sum += data[y * width * 4 + (x - 1) * 4 + c] * kernel[3];
        sum += data[y * width * 4 + x * 4 + c] * kernel[4];
        sum += data[y * width * 4 + (x + 1) * 4 + c] * kernel[5];
        sum += data[(y + 1) * width * 4 + (x - 1) * 4 + c] * kernel[6];
        sum += data[(y + 1) * width * 4 + x * 4 + c] * kernel[7];
        sum += data[(y + 1) * width * 4 + (x + 1) * 4 + c] * kernel[8];
        
        // Clamp values between 0-255
        outputData[offset + c] = Math.max(0, Math.min(255, sum));
      }
      
      // Keep alpha channel unchanged
      outputData[offset + 3] = data[offset + 3];
    }
  }
  
  return output;
}

const QRScanner: React.FC = () => {
  const { currentUser, checkInAttendee } = useAppStore();
  const navigate = useNavigate();
  
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    attendeeName?: string;
    timestamp?: string;
  } | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Redirect to login if not authenticated or not staff
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (currentUser.role !== 'staff') {
      navigate('/');
    }
  }, [currentUser, navigate]);
  
  useEffect(() => {
    // Initialize scanner
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode('reader');
    }
    
    // Cleanup on unmount
    return () => {
      try {
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(error => {
            console.error('Error stopping scanner on cleanup:', error);
          });
        }
      } catch (error) {
        console.error('Error in cleanup function:', error);
      }
      
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);
  
  const startScanner = () => {
    if (!scannerRef.current) return;
    
    setScanning(true);
    setScanResult(null);
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 450 },
      aspectRatio: 1.0
    };
    
    scannerRef.current.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      onScanFailure
    ).catch(error => {
      console.error('Error starting scanner:', error);
      setScanning(false);
    });
  };
  
  const stopScanner = () => {
    if (!scannerRef.current) return;
    
    try {
      // Check if the scanner is actually running before attempting to stop it
      if (scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(error => {
          console.error('Error stopping scanner:', error);
        });
      }
    } catch (error) {
      console.error('Error in stopScanner function:', error);
    } finally {
      // Always reset state regardless of success or failure
      setScanning(false);
      setScanResult(null);
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    }
  };
  
  const onScanSuccess = async (decodedText: string) => {
    // Pause scanning temporarily
    if (scannerRef.current) {
      scannerRef.current.pause();
    }
    
    try {
      // Process the QR code
      const result = await checkInAttendee(decodedText);
      
      setScanResult({
        success: result.success,
        message: result.message,
        attendeeName: result.attendee?.name,
        timestamp: new Date().toLocaleTimeString()
      });
      
      // Clear the result after 5 seconds and resume scanning
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
      
      resultTimeoutRef.current = setTimeout(() => {
        setScanResult(null);
        if (scannerRef.current && scanning) {
          scannerRef.current.resume();
        }
      }, 5000);
    } catch (error) {
      console.error('Error processing QR code:', error);
      setScanResult({
        success: false,
        message: 'Error processing QR code',
        timestamp: new Date().toLocaleTimeString()
      });
      
      // Resume scanning after error
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
      
      resultTimeoutRef.current = setTimeout(() => {
        setScanResult(null);
        if (scannerRef.current && scanning) {
          scannerRef.current.resume();
        }
      }, 3000);
    }
  };
  
  const onScanFailure = (error: string) => {
    // Don't show errors for normal scanning failures
    console.debug('QR scan error:', error);
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageDataUrl = e.target?.result as string;
        const img = new Image();
        img.src = imageDataUrl;
        img.onload = async () => {
          try {
            // Create a canvas with appropriate dimensions
            const canvas = document.createElement('canvas');
            
            // Ensure canvas dimensions match the image dimensions
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            // Get the 2D context with willReadFrequently option for better performance
            const context = canvas.getContext('2d', { willReadFrequently: true });
            
            if (context) {
              // Clear the canvas and draw the image
              context.clearRect(0, 0, canvas.width, canvas.height);
              context.drawImage(img, 0, 0);
              
              // Try different image processing approaches
              let code = null;
              console.log("Processing image with dimensions:", canvas.width, "x", canvas.height);
              
              // First attempt: Standard approach
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth" // Try both normal and inverted colors
              });
              
              // Try with sharpening before standard approach if initial attempt fails
              if (!code) {
                console.log("Trying with image sharpening...");
                // Apply sharpening
                const sharpenKernel = [
                  0, -1, 0,
                  -1, 5, -1,
                  0, -1, 0
                ];
                
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempContext = tempCanvas.getContext('2d');
                
                if (tempContext) {
                  tempContext.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const imgData = tempContext.getImageData(0, 0, canvas.width, canvas.height);
                  const sharpenedData = applySharpen(imgData, sharpenKernel, canvas.width, canvas.height);
                  tempContext.putImageData(sharpenedData, 0, 0);
                  
                  const sharpenedImageData = tempContext.getImageData(0, 0, canvas.width, canvas.height);
                  code = jsQR(sharpenedImageData.data, sharpenedImageData.width, sharpenedImageData.height, {
                    inversionAttempts: "attemptBoth"
                  });
                  
                  if (code) {
                    console.log("QR code found with sharpening");
                  }
                }
              }
              
              // Try multiple processing techniques if standard approach fails
              if (!code) {
                console.log("Standard approach failed, trying enhanced processing techniques");
                
                // Try different scaling factors - added more intermediate values for better detection
                const scaleFactors = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
                
                for (const scaleFactor of scaleFactors) {
                  if (code) break; // Exit if we found a code
                  
                  const scaledWidth = Math.floor(canvas.width * scaleFactor);
                  const scaledHeight = Math.floor(canvas.height * scaleFactor);
                  
                  // Skip if dimensions are too small
                  if (scaledWidth < 100 || scaledHeight < 100) continue;
                  
                  console.log("Trying scale factor:", scaleFactor, "(", scaledWidth, "x", scaledHeight, ")");
                  
                  // Create a new canvas with scaled dimensions
                  const scaledCanvas = document.createElement('canvas');
                  scaledCanvas.width = scaledWidth;
                  scaledCanvas.height = scaledHeight;
                  
                  const scaledContext = scaledCanvas.getContext('2d');
                  if (scaledContext) {
                    // Draw scaled image
                    scaledContext.drawImage(img, 0, 0, scaledWidth, scaledHeight);
                    
                    // Try normal scaled image
                    const scaledImageData = scaledContext.getImageData(0, 0, scaledWidth, scaledHeight);
                    code = jsQR(scaledImageData.data, scaledWidth, scaledHeight, {
                      inversionAttempts: "attemptBoth"
                    });
                    
                    if (code) {
                      console.log("QR code found with scaling");
                      break;
                    }
                    
                    // Try with increased contrast
                    scaledContext.drawImage(img, 0, 0, scaledWidth, scaledHeight);
                    const contrastData = scaledContext.getImageData(0, 0, scaledWidth, scaledHeight);
                    
                    // Apply contrast enhancement
                    const contrast = 1.5; // Increase contrast
                    for (let i = 0; i < contrastData.data.length; i += 4) {
                      // Apply to RGB channels
                      for (let j = 0; j < 3; j++) {
                        const channel = contrastData.data[i + j];
                        // Apply contrast formula: ((channel / 255 - 0.5) * contrast + 0.5) * 255
                        contrastData.data[i + j] = Math.max(0, Math.min(255, 
                          Math.floor(((channel / 255 - 0.5) * contrast + 0.5) * 255)
                        ));
                      }
                    }
                    
                    scaledContext.putImageData(contrastData, 0, 0);
                    code = jsQR(contrastData.data, scaledWidth, scaledHeight, {
                      inversionAttempts: "attemptBoth"
                    });
                    
                    if (code) {
                      console.log("QR code found with contrast enhancement");
                      break;
                    }
                    
                    // Try with grayscale conversion
                    scaledContext.drawImage(img, 0, 0, scaledWidth, scaledHeight);
                    const grayData = scaledContext.getImageData(0, 0, scaledWidth, scaledHeight);
                    
                    // Convert to grayscale
                    for (let i = 0; i < grayData.data.length; i += 4) {
                      const gray = Math.round(
                        0.299 * grayData.data[i] + 
                        0.587 * grayData.data[i + 1] + 
                        0.114 * grayData.data[i + 2]
                      );
                      grayData.data[i] = gray;
                      grayData.data[i + 1] = gray;
                      grayData.data[i + 2] = gray;
                    }
                    
                    scaledContext.putImageData(grayData, 0, 0);
                    code = jsQR(grayData.data, scaledWidth, scaledHeight, {
                      inversionAttempts: "attemptBoth"
                    });
                    
                    if (code) {
                      console.log("QR code found with grayscale conversion");
                      break;
                    }
                  }
                }
              }
              
              if (code) {
                console.log("QR Code detected, data:", code.data.substring(0, 20) + "...");
                // Process the QR code data directly
                try {
                  const result = await checkInAttendee(code.data);
                  setScanResult({
                    success: result.success,
                    message: result.success ? 
                      `Successfully checked in ${result.attendee?.name}` : 
                      result.message || 'Check-in failed',
                    attendeeName: result.attendee?.name,
                    timestamp: new Date().toLocaleTimeString()
                  });
                } catch (error) {
                  console.error('Error checking in attendee:', error);
                  setScanResult({
                    success: false,
                    message: 'Error processing check-in. Please try again.',
                    timestamp: new Date().toLocaleTimeString()
                  });
                }
              } else {
                console.error("No QR code found in the image");
                setScanResult({
                  success: false,
                  message: 'No QR code found in the image. Try a clearer image or different lighting. Make sure the QR code is well-lit and in focus.',
                  timestamp: new Date().toLocaleTimeString()
                });
              }
            }
          } catch (error) {
            console.error('Error processing QR code image:', error);
            setScanResult({
              success: false,
              message: 'Error processing QR code image: ' + (error instanceof Error ? error.message : String(error)),
              timestamp: new Date().toLocaleTimeString()
            });
          };
        };
      };
      reader.readAsDataURL(file);
    }
  };
  
  if (!currentUser || currentUser.role !== 'staff') {
    return null;
  }
  
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">QR Code Scanner</h1>
        <p className="text-gray-600">
          Scan attendee QR codes to check them in
        </p>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Scanner</h3>
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={scanning ? stopScanner : startScanner}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                scanning 
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              {scanning ? (
                <>
                  <CameraOff className="-ml-1 mr-2 h-5 w-5" />
                  Stop Scanner
                </>
              ) : (
                <>
                  <Camera className="-ml-1 mr-2 h-5 w-5" />
                  Start Scanner
                </>
              )}
            </button>
            <div>
              <input
                type="file"
                accept=".png, .jpg, .jpeg, .gif"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2"
              >
                Upload QR Code
              </button>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            {/* Scanner container */}
            <div 
              id="reader" 
              className={`w-full ${scanning ? 'h-64' : 'h-0'} overflow-hidden transition-all duration-300 mb-4 relative`}
            >
              {scanning && (
                <>
                  <div className="absolute inset-0 bg-black bg-opacity-50">
                  <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white">
                      {/* Corner markers */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
                      {/* Scanning line animation */}
                      <div className="absolute left-0 w-full h-0.5 bg-green-500 animate-scan"></div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {!scanning && !scanResult && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Camera className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No scanner active</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Click the "Start Scanner" button to begin scanning QR codes.
                </p>
              </div>
            )}
            
            {/* Scan result */}
            {scanResult && (
              <div className={`mt-4 p-4 rounded-md ${
                scanResult.success ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {scanResult.success ? (
                      <CheckCircle className={`h-5 w-5 text-green-400`} />
                    ) : (
                      <XCircle className={`h-5 w-5 text-red-400`} />
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-sm font-medium ${
                      scanResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {scanResult.success ? 'Check-in Successful' : 'Check-in Failed'}
                    </h3>
                    <div className={`mt-2 text-sm ${
                      scanResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      <p>{scanResult.message}</p>
                      {scanResult.attendeeName && (
                        <p className="font-medium mt-1">Attendee: {scanResult.attendeeName}</p>
                      )}
                      {scanResult.timestamp && (
                        <p className="text-xs mt-1">Time: {scanResult.timestamp}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Instructions */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900">Instructions</h4>
              <ul className="mt-2 text-sm text-gray-500 list-disc list-inside space-y-1">
                <li>Click "Start Scanner" to activate the camera</li>
                <li>Position the QR code within the scanning area</li>
                <li>Hold steady until the code is recognized</li>
                <li>Check the result message for confirmation</li>
                <li>The scanner will automatically resume after each scan</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;