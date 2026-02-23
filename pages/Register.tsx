
import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { UserRole } from '../types';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({ fullName: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.registerUser({ ...formData, role: UserRole.USER });
    setSuccess(true);
    setTimeout(() => window.location.hash = '#', 2000);
  };

  if (success) return (
    <div className="glass-card p-10 rounded-[3rem] text-center max-w-md mx-auto animate-in zoom-in duration-500 bg-white/90 dark:bg-white/5">
        <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-5xl shadow-lg shadow-emerald-500/10">✓</div>
        <h2 className="text-2xl font-black mb-4 text-slate-900 dark:text-white">أهلاً بك في عائلتنا!</h2>
        <p className="text-slate-500 dark:text-slate-400 font-bold">تم إنشاء حسابك بنجاح. جاري توجيهك...</p>
    </div>
  );

  return (
    <div className="glass-card p-10 rounded-[3rem] shadow-2xl max-w-md mx-auto border-slate-200 dark:border-indigo-500/10 bg-white/90 dark:bg-white/5 animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-600/30">Q</div>
      </div>
      <h2 className="text-3xl font-black mb-8 text-center text-slate-900 dark:text-white tracking-tight">فتح حساب جديد</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 mb-2 uppercase tracking-widest px-1">الاسم الرباعي</label>
          <input 
            type="text" 
            required
            value={formData.fullName}
            onChange={e => setFormData({...formData, fullName: e.target.value})}
            className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all placeholder-slate-400"
            placeholder="مثال: أحمد محمد علي القدسي"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 mb-2 uppercase tracking-widest px-1">رقم الهاتف</label>
          <input 
            type="tel" 
            required
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
            className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all placeholder-slate-400"
            placeholder="77xxxxxxx"
          />
        </div>
        <div className="relative">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 mb-2 uppercase tracking-widest px-1">كلمة المرور</label>
          <input 
            type={showPassword ? "text" : "password"} 
            required
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
            className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all placeholder-slate-400"
            placeholder="••••••••"
          />
          <button 
            type="button" 
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-4 bottom-3.5 text-slate-400"
          >
            {showPassword ? '👁️' : '🔒'}
          </button>
        </div>
        <button 
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-[2rem] font-black text-white shadow-xl shadow-indigo-600/30 transition-all transform active:scale-[0.98]"
        >
          إنشاء الحساب الآن ✨
        </button>
      </form>
    </div>
  );
};

export default Register;
