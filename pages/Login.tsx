
import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { User, UserRole, Agent } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAuthenticating(true);
    
    try {
      const result = await StorageService.authenticate(identifier, password);
      
      if (typeof result === 'string') {
        setError(result);
      } else {
        if (result.role === UserRole.AGENT) {
          const agent = result as Agent;
          if (!agent.isActive) {
            setError('حسابك قيد المراجعة أو معلق أمنياً.');
            setIsAuthenticating(false);
            return;
          }
        }
        onLogin(result);
      }
    } catch (err) {
      setError('حدث خطأ غير متوقع أثناء الاتصال الآمن.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 w-full max-w-md">
      <div className="glass-card p-10 rounded-[3rem] shadow-xl border-slate-200 dark:border-indigo-500/10 bg-white/90 dark:bg-white/5 relative overflow-hidden">
        {isAuthenticating && (
          <div className="absolute inset-0 bg-indigo-600/5 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3">
             <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">جاري التحقق الأمني...</span>
          </div>
        )}
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-600/30">Q</div>
        </div>
        <h2 className="text-3xl font-black mb-2 text-center text-slate-900 dark:text-white tracking-tight">الدخول الآمن</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest px-1">رقم الهاتف أو البريد</label>
            <input 
              type="text" 
              value={identifier}
              autoComplete="username"
              onChange={e => setIdentifier(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-900 dark:text-white"
              placeholder="77xxxxxxx أو email@domain.com"
              required
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest px-1">كلمة المرور</label>
            <input 
              type={showPassword ? "text" : "password"} 
              value={password}
              autoComplete="current-password"
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-900 dark:text-white"
              placeholder="••••••••"
              required
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-4 bottom-3.5 text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {showPassword ? '👁️' : '🔒'}
            </button>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-rose-600 dark:text-rose-400 text-[10px] font-black text-center animate-shake">
              ⚠️ {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isAuthenticating}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-[2rem] font-black text-white shadow-xl shadow-indigo-600/30 transition-all transform active:scale-[0.98]"
          >
            {isAuthenticating ? 'جاري المعالجة...' : 'تسجيل دخول 🔐'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
