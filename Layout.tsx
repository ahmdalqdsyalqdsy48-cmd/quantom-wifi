import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, UserRole } from '../types';

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
}

const NotificationContext = createContext({
  showNotification: (msg: string, type: 'success' | 'error' | 'info' = 'info') => {}
});

export const useNotification = () => useContext(NotificationContext);

interface LayoutProps {
  children: React.ReactNode;
  user?: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('qw_theme') === 'dark' || document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('qw_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('qw_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      <div className="min-h-screen flex flex-col text-sm transition-colors duration-300">
        {/* Notifications */}
        {notification && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[999] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className={`px-6 py-2 rounded-full font-bold shadow-2xl border ${
              notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
              notification.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' :
              'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
            }`}>
              {notification.message}
            </div>
          </div>
        )}

        {/* Header */}
        <header className="glass-card sticky top-0 z-50 px-4 py-2 flex justify-between items-center shadow-sm dark:shadow-none border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-indigo-950/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-indigo-500/30 shadow-md">Q</div>
            <h1 className="text-lg font-black tracking-tight bg-gradient-to-l from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent">كوانتوم فاي</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-200 dark:border-white/10"
              title={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الليلي"}
            >
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>

            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">{user.fullName}</span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 leading-tight">
                    {user.role === UserRole.ADMIN ? 'إدارة عليا' : user.role === UserRole.AGENT ? 'مدير شبكة' : `${user.pointsBalance} نقطة`}
                  </span>
                </div>
                <button 
                  onClick={onLogout}
                  className="px-3 py-1 rounded-full border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-all text-[10px] font-bold"
                >
                  خروج
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
          {children}
        </main>

        {/* Footer - Hidden for Admin */}
        {user?.role !== UserRole.ADMIN && (
          <footer className="py-4 text-center text-slate-400 dark:text-slate-600 text-[10px] border-t border-slate-200 dark:border-white/5 mt-8 opacity-70">
            منصة كوانتوم &copy; {new Date().getFullYear()} - الحل الأمثل لإدارة كروت الواي فاي
          </footer>
        )}
      </div>
    </NotificationContext.Provider>
  );
};

export default Layout;