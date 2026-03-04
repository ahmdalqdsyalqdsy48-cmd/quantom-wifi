
import React, { useState, useEffect } from 'react';
import { User, UserRole, Agent } from './types';
import { StorageService } from './services/storage';
import Layout from './components/Layout';

// Mock Pages
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    StorageService.init();
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    
    const saved = localStorage.getItem('qw_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Verify user still exists in storage AND is active
      const exists = StorageService.getUsers().find(u => u.id === parsed.id);
      if (exists && exists.isActive !== false) {
        setCurrentUser(exists);
      } else {
        localStorage.removeItem('qw_current_user');
        setCurrentUser(null);
      }
    }
    setLoading(false);
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogin = (user: User) => {
    StorageService.logAction('تسجيل دخول', `تم تسجيل دخول المستخدم ${user.fullName}`, user.fullName, 'SYSTEM');
    setCurrentUser(user);
    localStorage.setItem('qw_current_user', JSON.stringify(user));
    window.location.hash = '';
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('qw_current_user');
    window.location.hash = '';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-indigo-500 font-bold">جاري التحميل...</div>;

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      {!currentUser ? (
        <div className="flex flex-col gap-8 items-center py-12">
          <div className="max-w-md w-full">
            {currentHash === '#register' ? (
              <div className="space-y-6">
                <Register />
                <div className="text-center">
                  <button onClick={() => window.location.hash = ''} className="text-indigo-400 text-sm hover:underline">لديك حساب بالفعل؟ سجل دخولك</button>
                </div>
              </div>
            ) : (
              <>
                <Login onLogin={handleLogin} />
                <div className="text-center mt-6">
                  <p className="text-slate-400 mb-2">ليس لديك حساب؟</p>
                  <button 
                    onClick={() => window.location.hash = '#register'} 
                    className="text-indigo-400 font-bold hover:underline"
                  >
                    إنشاء حساب مستخدم جديد
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && <AdminDashboard currentUser={currentUser} />}
          {currentUser.role === UserRole.AGENT && <AgentDashboard user={currentUser as Agent} />}
          {currentUser.role === UserRole.USER && <UserDashboard user={currentUser} onUpdate={() => setCurrentUser({...StorageService.getUsers().find(u => u.id === currentUser.id)!})} />}
        </>
      )}
    </Layout>
  );
};

export default App;
