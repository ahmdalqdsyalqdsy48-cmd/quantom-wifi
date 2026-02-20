
import React, { useState, useEffect } from 'react';
import { User, Category, Order, Agent, BankAccount, CardStatus, Status } from '../types';
import { StorageService } from '../services/storage';
import { useNotification } from '../components/Layout';

interface UserDashboardProps {
  user: User;
  onUpdate: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, onUpdate }) => {
  const { showNotification } = useNotification();
  const [activeView, setActiveView] = useState<'shopping' | 'settings'>('shopping');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ cat: Category, qty: number } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  
  // Forms
  const [form, setForm] = useState({ amount: '', method: '', ref: '', client: '' });
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [passForm, setPassForm] = useState({ new: '', confirm: '' });

  const refreshData = () => {
    const activeAgents = StorageService.getAgents().filter(a => a.isActive);
    setAgents(activeAgents);
    setOrders(StorageService.getOrders(user.id, user.role));
    setBanks(StorageService.getBankAccounts().filter(b => b.isActive));

    const res = JSON.parse(localStorage.getItem('qw_kroot_v2') || '[]');
    const counts: Record<string, number> = {};
    res.forEach((k: any) => {
       if (k.status === CardStatus.AVAILABLE) counts[k.categoryId] = (counts[k.categoryId] || 0) + 1;
    });
    setStockMap(counts);
  };

  useEffect(() => { refreshData(); }, [user.id, user.pointsBalance]);

  const handleBuy = async () => {
    if (!showConfirm) return;
    const res = await StorageService.createOrder(user.id, showConfirm.cat.id, showConfirm.qty);
    if (typeof res === 'string') showNotification(res, 'error');
    else {
      showNotification('تمت عملية الشراء بنجاح! ✅', 'success');
      onUpdate(); setShowConfirm(null); refreshData();
    }
  };

  const handleUpdatePassword = () => {
    if (!passForm.new || passForm.new !== passForm.confirm) return showNotification('كلمات المرور غير متطابقة', 'error');
    StorageService.updatePassword(user.id, passForm.new);
    showNotification('تم تحديث كلمة المرور بنجاح ✅');
    setPassForm({ new: '', confirm: '' });
  };

  const handleQtyChange = (catId: string, val: string, max: number) => {
    let num = parseInt(val) || 0;
    if (num < 0) num = 1;
    if (num > max) num = max;
    setQtyMap({...qtyMap, [catId]: num});
  };

  const filteredAgents = agents.filter(a => a.networkName.includes(searchQuery));
  const filteredCategories = categories.filter(c => c.name.includes(searchQuery));
  const filteredOrders = orders.filter(o => o.networkName.includes(searchQuery));
  const selectedBank = banks.find(b => b.bankName === form.method);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => setActiveView('shopping')} className={`px-4 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap ${activeView === 'shopping' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>🛒 تسوق الآن</button>
        <button onClick={() => setActiveView('settings')} className={`px-4 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap ${activeView === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>🔐 إعدادات الأمان</button>
      </div>

      {activeView === 'shopping' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-6 rounded-[2rem] bg-indigo-600 text-white shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-3 opacity-10 text-5xl">💎</div>
               <p className="text-[8px] font-black opacity-70 mb-1 uppercase tracking-widest">رصيدك الحالي</p>
               <div className="text-3xl font-black mb-4">{user.pointsBalance} <span className="text-[8px] uppercase opacity-80 font-bold">نقطة</span></div>
               <button onClick={() => setShowPointsModal(true)} className="w-full py-3 bg-white text-indigo-600 rounded-xl font-black text-[10px] shadow-lg active:scale-95 transition-all">شحن رصيد +</button>
            </div>
            <div className="glass-card p-4 rounded-[2rem] border bg-white dark:bg-white/5 space-y-3">
               <h3 className="font-black text-[9px] text-slate-400 px-1 tracking-widest uppercase">الشبكات المتوفرة</h3>
               <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar">
                  {filteredAgents.map(a => (
                    <button key={a.id} onClick={() => { setSelectedAgent(a); setCategories(StorageService.getCategories(a.id).filter(c => c.isActive)); }} className={`w-full p-3 rounded-xl text-right border transition-all flex justify-between items-center ${selectedAgent?.id === a.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100'}`}><span className="font-black text-[10px]">{a.networkName}</span><span className="text-[8px] opacity-40">◀</span></button>
                  ))}
               </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {selectedAgent ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <h2 className="col-span-full text-base font-black text-slate-900 dark:text-white flex items-center gap-2">📡 فئات {selectedAgent.networkName}</h2>
                 {filteredCategories.map(c => {
                    const available = stockMap[c.id] || 0;
                    const qty = qtyMap[c.id] === undefined ? 1 : qtyMap[c.id];
                    return (
                      <div key={c.id} className="glass-card p-5 rounded-[2rem] border space-y-3 hover:shadow-lg transition-all">
                         <div className="flex justify-between items-start">
                            <div><h4 className="font-black text-sm leading-none">{c.name}</h4><span className="text-[8px] text-indigo-600 font-black mt-1 inline-block">{c.dataSize}</span></div>
                            <div className={`text-[8px] font-black px-2 py-0.5 rounded-md ${available > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{available > 0 ? `متوفر: ${available}` : 'نفد'}</div>
                         </div>
                         <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
                            <div className="flex items-center gap-2">
                               <button onClick={() => handleQtyChange(c.id, (qty - 1).toString(), available)} className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg font-black shadow-sm text-xs">-</button>
                               <input 
                                 type="number" 
                                 value={qty}
                                 onChange={(e) => handleQtyChange(c.id, e.target.value, available)}
                                 className="w-10 bg-transparent text-center font-black text-xs outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                               />
                               <button onClick={() => handleQtyChange(c.id, (qty + 1).toString(), available)} className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg font-black shadow-sm text-xs">+</button>
                            </div>
                            <div className="text-left font-black text-lg">{(c.pointsPrice * qty)} <span className="text-[8px]">نقطة</span></div>
                         </div>
                         <button disabled={available === 0 || qty === 0} onClick={() => setShowConfirm({ cat: c, qty })} className={`w-full py-3 rounded-xl font-black text-[10px] shadow-md transition-all ${available > 0 && qty > 0 ? 'bg-indigo-600 text-white active:scale-95' : 'bg-slate-100 text-slate-400'}`}>{available > 0 ? 'شراء الآن ⚡' : 'نفد المخزون'}</button>
                      </div>
                    );
                 })}
              </div>
            ) : (
              <div className="glass-card py-16 rounded-[3rem] text-center border-dashed border-2 text-slate-300 dark:border-white/5">
                <div className="text-6xl mb-4 opacity-20">🛒</div>
                <h3 className="text-base font-black">يرجى اختيار شبكة للبدء بالتسوق</h3>
              </div>
            )}

            {orders.length > 0 && (
               <div className="space-y-3 pt-6 border-t dark:border-white/5">
                  <h2 className="text-base font-black flex items-center gap-2">🎟️ الكروت المشتراة</h2>
                  <div className="glass-card rounded-[1.5rem] overflow-hidden border bg-white dark:bg-white/5">
                    <div className="w-full">
                       <table className="w-full text-right text-[8px] md:text-[9px] border-collapse">
                          <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 font-black border-b dark:border-white/10">
                             <tr><th className="px-3 py-3">الشبكة</th><th className="px-3 py-3">الكود</th><th className="px-3 py-3 text-center">النقاط</th><th className="px-3 py-3 text-center">التاريخ</th><th className="px-3 py-3 text-center">إجراء</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                             {orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(o => (
                               <tr key={o.id} className="hover:bg-indigo-50/10">
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[80px]">{o.networkName}</td>
                                  <td className="px-3 py-2 font-mono text-indigo-600">
                                     {revealed[o.id] ? StorageService.decryptCardCode(o.cardNumber!) : '••••••••••••'}
                                  </td>
                                  <td className="px-3 py-2 text-center text-slate-500">{o.pointsUsed}</td>
                                  <td className="px-3 py-2 text-center opacity-60 font-mono text-[7px]">{new Date(o.createdAt).toLocaleDateString('ar-YE')}</td>
                                  <td className="px-3 py-2 text-center"><div className="flex gap-1.5 justify-center">
                                     <button onClick={() => setRevealed({...revealed, [o.id]: !revealed[o.id]})} className="p-1.5 bg-indigo-50 dark:bg-white/5 text-indigo-600 rounded-md text-[10px] leading-none">{revealed[o.id] ? '🙈' : '👁️'}</button>
                                     {revealed[o.id] && <button onClick={() => { navigator.clipboard.writeText(StorageService.decryptCardCode(o.cardNumber!)); showNotification('تم النسخ ✅'); }} className="p-1.5 bg-indigo-600 text-white rounded-md text-[10px] leading-none">📋</button>}
                                  </div></td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                  </div>
               </div>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto glass-card p-8 rounded-[3rem] border space-y-6 text-center shadow-2xl">
           <div className="w-20 h-20 bg-indigo-600/10 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-2 text-3xl">🔐</div>
           <h3 className="text-xl font-black text-indigo-600 tracking-tight">إعدادات الأمان</h3>
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest border-b dark:border-white/5 pb-3">تحديث كلمة مرور الدخول</p>
           <div className="space-y-4 pt-2">
              <div className="text-right">
                 <label className="text-[8px] font-black text-slate-400 mr-2 uppercase tracking-widest">كلمة المرور الجديدة</label>
                 <input type="password" value={passForm.new} onChange={e => setPassForm({...passForm, new: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-white/10 p-4 rounded-2xl outline-none text-xs font-bold" placeholder="أدخل كلمة المرور الجديدة" />
              </div>
              <div className="text-right">
                 <label className="text-[8px] font-black text-slate-400 mr-2 uppercase tracking-widest">تأكيد كلمة المرور</label>
                 <input type="password" value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-white/10 p-4 rounded-2xl outline-none text-xs font-bold" placeholder="كرر كلمة المرور مرة أخرى" />
              </div>
              <button onClick={handleUpdatePassword} className="w-full py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-xs shadow-xl active:scale-95 transition-all mt-4">تحديث كلمة السر الآمنة ✨</button>
           </div>
        </div>
      )}

      {showPointsModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
           <div className="glass-card w-full max-w-sm p-6 rounded-[2rem] bg-white dark:bg-indigo-950 shadow-2xl space-y-4">
              <h3 className="text-lg font-black text-indigo-600 border-b dark:border-white/5 pb-2">📥 شحن الرصيد</h3>
              <div className="space-y-3">
                 <input type="number" placeholder="عدد النقاط" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border text-sm font-black text-indigo-600 outline-none" />
                 <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border text-[10px] font-bold outline-none">
                    <option value="">-- اختر البنك --</option>
                    {banks.map(b => <option key={b.id} value={b.bankName}>{b.bankName}</option>)}
                 </select>
                 {selectedBank && (
                   <div className="p-3 bg-indigo-600 text-white rounded-xl text-center animate-in zoom-in duration-300"><p className="text-[8px] opacity-70">حول للحساب:</p><p className="font-black text-xs">{selectedBank.accountHolder}</p><p className="font-mono text-[10px] tracking-widest">{selectedBank.accountNumber}</p></div>
                 )}
                 <input type="text" placeholder="رقم الحوالة (المرجع)" value={form.ref} onChange={e => setForm({...form, ref: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border text-xs font-mono outline-none" />
                 <input type="text" placeholder="اسم المودع الرباعي" value={form.client} onChange={e => setForm({...form, client: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border text-xs font-black outline-none" />
                 <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowPointsModal(false)} className="flex-1 py-3.5 bg-slate-100 dark:bg-white/10 rounded-xl font-black text-[10px]">إلغاء</button>
                    <button onClick={() => { if(!form.amount || !form.ref || !form.client) return showNotification('أكمل البيانات', 'error'); StorageService.createPointsRequest(user.id, user.fullName, parseInt(form.amount), form.method, form.ref, form.client); showNotification('تم الإرسال ✅'); setShowPointsModal(false); }} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[10px]">إرسال</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
           <div className="glass-card w-full max-w-xs p-8 rounded-[2rem] bg-white dark:bg-indigo-950 text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto text-2xl shadow-lg">🛍️</div>
              <h3 className="text-base font-black">تأكيد الشراء</h3>
              <p className="text-[9px] text-slate-500 font-bold px-2">شراء {showConfirm.qty} كرت فئة "{showConfirm.cat.name}" بخصم {showConfirm.qty * showConfirm.cat.pointsPrice} نقطة؟</p>
              <div className="flex gap-2 pt-4">
                 <button onClick={() => setShowConfirm(null)} className="flex-1 py-3 bg-slate-100 dark:bg-white/10 rounded-xl font-black text-[10px]">تراجع</button>
                 <button onClick={handleBuy} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] active:scale-95 transition-all">تأكيد وشراء ✅</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
