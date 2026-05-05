
import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { User, UserRole } from './types';
import { StorageService } from './services/storageService';
import { Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = StorageService.subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await StorageService.logout();
  };

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
      );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="antialiased text-gray-900">
      {user.role === UserRole.ADMIN || user.role === UserRole.STAFF ? (
        <AdminDashboard onLogout={handleLogout} currentUser={user} />
      ) : (
        <CustomerDashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
