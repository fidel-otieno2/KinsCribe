import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import FamilyGate from './pages/FamilyGate';
import Feed from './pages/Feed';
import Timeline from './pages/Timeline';
import Storybooks from './pages/Storybooks';
import Profile from './pages/Profile';
import FamilyMembers from './pages/FamilyMembers';
import Layout from './components/Layout';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ color: '#555', textAlign: 'center', marginTop: 100 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!user.family_id) return <Navigate to="/family-gate" />;
  return children;
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
      <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
      <Route path="/family-gate" element={<FamilyGate />} />
      <Route path="/" element={<PrivateRoute><Layout><Feed /></Layout></PrivateRoute>} />
      <Route path="/timeline" element={<PrivateRoute><Layout><Timeline /></Layout></PrivateRoute>} />
      <Route path="/storybooks" element={<PrivateRoute><Layout><Storybooks /></Layout></PrivateRoute>} />
      <Route path="/family" element={<PrivateRoute><Layout><FamilyMembers /></Layout></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#f0f0f0', border: '1px solid #2a2a2a' } }} />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
