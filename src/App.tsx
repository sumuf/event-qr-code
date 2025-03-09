import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EventList from './pages/EventList';
import EventForm from './pages/EventForm';
import EventDetail from './pages/EventDetail';
import AttendeeImport from './pages/AttendeeImport';
import AttendeeForm from './pages/AttendeeForm';
import QRScanner from './pages/QRScanner';
import UserManagement from './pages/UserManagement';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useAppStore from './store'; // Fixed: Changed from import { useAppStore } to import useAppStore

function App() {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Change the root route to check authentication */}
        <Route path="/" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
        
        {/* Add RequireAuth to other protected routes */}
        <Route path="/events/*" element={<RequireAuth><Layout><EventList /></Layout></RequireAuth>} />
        <Route path="/events/new" element={<RequireAuth><Layout><EventForm /></Layout></RequireAuth>} />
        <Route path="/events/:id" element={<RequireAuth><Layout><EventDetail /></Layout></RequireAuth>} />
        <Route path="/events/:id/edit" element={<RequireAuth><Layout><EventForm /></Layout></RequireAuth>} />
        
        <Route path="/attendees/import" element={<RequireAuth><Layout><AttendeeImport /></Layout></RequireAuth>} />
        <Route path="/attendees/new" element={<RequireAuth><Layout><AttendeeForm /></Layout></RequireAuth>} />
        
        <Route path="/scanner" element={<RequireAuth><Layout><QRScanner /></Layout></RequireAuth>} />
        
        <Route path="/users" element={<RequireAuth><Layout><UserManagement /></Layout></RequireAuth>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

// Add this component to handle auth checking
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAppStore();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export default App;