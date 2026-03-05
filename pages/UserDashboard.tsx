import React, { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { 
  Home, Wifi, Gift, CreditCard, PlusCircle, Send, 
  FileText, Settings, Share2, LogOut, Menu, X, 
  Wallet, ArrowUpRight, Copy, ShoppingBag, 
  Phone, Mail, MessageCircle, Download,
  Zap, QrCode, Users, BarChart3, Inbox, 
  Facebook, Twitter, Instagram, Eye, EyeOff,
  Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';
import { StorageService } from '../services/storage';
import { useNotification } from '../components/Layout';
import { User, Agent, Category, Order, Deposit, BankAccount, Status, CardStatus, Transaction } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const UserDashboard: React.FC<{ user: User; onUpdate: () => void }> = ({ user, onUpdate }) => {
  const { showNotification } = useNotification();
  const [activeSection, setActiveSection] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ cat: Category; qty: number } | null>(null);
  const [topupForm, setTopupForm] = useState({ amount: '', method: '', ref: '', client: '' });
  const [transferForm, setTransferForm] = useState({ phone: '', amount: '' });
  const [passForm, setPassForm] = useState({ new: '', confirm: '' });
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'purchase' | 'deposit' | 'transfer'>('all');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketForm, setTicketForm] = useState({ title: '', message: '', recipient: 'ADMIN' });
  const [ticketDateFilter, setTicketDateFilter] = useState('all');

  const refreshData = () => {
    const allAgents = StorageService.getAgents().filter(a => a.isActive);
    setAgents(allAgents);
    
    const allCats: Category[] = [];
    allAgents.forEach(agent => {
      allCats.push(...StorageService.getCategories(agent.id).filter(c => c.isActive));
    });
    setCategories(allCats);

    setOrders(StorageService.getOrders(user.id, user.role));
    setBanks(StorageService.getBankAccounts().filter(b => b.isActive));
    setTickets(StorageService.getSupportTickets(user.id, user.role));
  };

  useEffect(() => {
    refreshData();
  }, [user.id]);

  const transactions = useMemo(() => {
    const txs = StorageService.getTransactions(user.id);
    return txs
      .filter(tx => {
        if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
        if (dateFilter.from && new Date(tx.date) < new Date(dateFilter.from)) return false;
        if (dateFilter.to && new Date(tx.date) > new Date(dateFilter.to)) return false;
        
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          return tx.details.toLowerCase().includes(s) || 
                 tx.amount.toString().includes(s) ||
                 tx.type.toLowerCase().includes(s);
        }
        
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [user.id, txTypeFilter, dateFilter, searchTerm]);
  
  const menuItems = [
    { id: 'home', label: '🏠 القائمــــة الرئيسيــــة', icon: Home },
    { id: 'networks', label: '🛒 متجـــــــر الشبكات', icon: ShoppingBag },
    { id: 'points_store', label: '🎁 متجـــــــر النقـــــــاط', icon: Gift },
    { id: 'my_cards', label: '💳 سجـــــــل كروتـــــــي', icon: CreditCard },
    { id: 'topup', label: '➕ شحـــــــن الرصيـــــــد', icon: PlusCircle },
    { id: 'transfer', label: '💸 تحويـــــــل رصيـــــــد', icon: Send },
    { id: 'statement', label: '📝 كشـــــــف الحســـــــاب', icon: FileText },
    { id: 'tickets', label: '🎫 تذاكـــــر الدعــــــــم', icon: Icons.Ticket },
    { id: 'settings', label: '⚙️ إعـــــدادات الحســــاب', icon: Settings },
    { id: 'share', label: '📤 مشاركــــة رابط الموقع', icon: Share2 },
  ];

  const handleBuy = async () => {
    if (!showConfirm) return;
    const { cat, qty } = showConfirm;
    
    try {
      const result = await StorageService.createOrder(user.id, cat.id, qty);
      if (typeof result !== 'string') {
        showNotification('تمت عملية الشراء بنجاح ✅');
        setShowConfirm(null);
        onUpdate();
        refreshData();
      } else {
        showNotification(result, 'error');
      }
    } catch (error: any) {
      showNotification(error.message || 'فشلت عملية الشراء', 'error');
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF('p', 'pt');
    
    const tableData = transactions.map(tx => [
      new Date(tx.date).toLocaleDateString('ar-YE'),
      tx.type === 'purchase' ? 'مشتريات' : tx.type === 'deposit' ? 'شحن' : 'تحويل',
      tx.details,
      tx.amount,
      tx.balanceAfter || '-'
    ]);

    (doc as any).autoTable({
      head: [['التاريخ', 'النوع', 'التفاصيل', 'المبلغ', 'الرصيد']],
      body: tableData,
      styles: { halign: 'right' },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`statement-${user.fullName}-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    const s = searchTerm.toLowerCase();
    return categories.filter(c => 
      c.name.toLowerCase().includes(s) || 
      c.networkName?.toLowerCase().includes(s)
    );
  }, [categories, searchTerm]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const s = searchTerm.toLowerCase();
    return orders.filter(o => 
      o.networkName.toLowerCase().includes(s) || 
      o.categoryName.toLowerCase().includes(s) ||
      o.cardNumber.toLowerCase().includes(s)
    );
  }, [orders, searchTerm]);

  const filteredAgents = useMemo(() => {
    if (!searchTerm) return agents;
    const s = searchTerm.toLowerCase();
    return agents.filter(a => 
      a.networkName.toLowerCase().includes(s) || 
      a.fullName.toLowerCase().includes(s)
    );
  }, [agents, searchTerm]);

  const renderHome = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">أهلاً بك، {user.fullName} 👋</h2>
          <p className="text-xs text-slate-400 font-bold">إليك نظرة سريعة على نشاط حسابك اليوم</p>
        </div>
        <div className="glass-card p-4 rounded-3xl border bg-white dark:bg-white/5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Zap size={20} /></div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold">حالة الحساب</p>
            <p className="text-xs font-black text-indigo-600">نشط 🟢</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-8 rounded-[2.5rem] border bg-white dark:bg-white/5 flex flex-col items-center text-center group">
          <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <QrCode size={40} className="text-indigo-600" />
          </div>
          <h4 className="font-black text-lg mb-2">رمز QR الخاص بي</h4>
          <p className="text-[10px] text-slate-400 font-bold mb-6">استخدم الكود للشحن السريع والتحويل</p>
          <button onClick={() => setShowQRModal(true)} className="w-full py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all">اعرض الكود 👁️</button>
        </div>

        <div className="glass-card p-8 rounded-[2.5rem] border bg-white dark:bg-white/5 flex flex-col items-center text-center group">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Users size={40} className="text-emerald-600" />
          </div>
          <h4 className="font-black text-lg mb-2">كود الإحالة</h4>
          <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl mb-6 w-full font-mono font-black text-indigo-600 tracking-widest">{user.id.slice(-6).toUpperCase()}</div>
          <button onClick={() => { navigator.clipboard.writeText(user.id.slice(-6).toUpperCase()); showNotification('تم نسخ كود الإحالة ✅'); }} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-xl">مشاركة الكود 📤</button>
        </div>

        <div className="glass-card p-8 rounded-[2.5rem] bg-indigo-950 text-white shadow-2xl relative overflow-hidden flex flex-col justify-center border border-white/10">
          <div className="absolute top-0 right-0 p-6 opacity-10 text-9xl">💎</div>
          <p className="text-xs font-black opacity-70 mb-2 uppercase tracking-widest">الرصيد الأساسي</p>
          <div className="text-5xl font-black mb-6">{user.pointsBalance} <span className="text-sm opacity-60">نقطة</span></div>
          <div className="flex gap-3">
            <button onClick={() => setActiveSection('topup')} className="flex-1 py-3 bg-white text-indigo-950 rounded-xl font-black text-xs">شحن +</button>
            <button onClick={() => setActiveSection('points_store')} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs">متجر النقاط 🎁</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-black text-xl">إحصائيات العمليات</h3>
              <p className="text-[10px] text-slate-400 font-bold">ملخص نشاطك خلال آخر 7 أيام</p>
            </div>
            <BarChart3 size={24} className="text-indigo-600" />
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { day: 'السبت', value: 120 }, { day: 'الأحد', value: 250 }, { day: 'الاثنين', value: 180 },
                { day: 'الثلاثاء', value: 320 }, { day: 'الأربعاء', value: 210 }, { day: 'الخميس', value: 450 }, { day: 'الجمعة', value: 380 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#4f46e5" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-xl">أحدث العمليات</h3>
            <button onClick={() => setActiveSection('statement')} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">عرض الكل</button>
          </div>
          <div className="space-y-6 flex-1">
            {transactions.slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", t.amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                  {t.amount > 0 ? <ArrowUpRight size={20} /> : <ShoppingBag size={20} />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black">{t.details}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{new Date(t.date).toLocaleDateString('ar-YE')}</p>
                </div>
                <div className={cn("text-sm font-black", t.amount > 0 ? "text-emerald-600" : "text-rose-600")}>{t.amount > 0 ? '+' : ''}{t.amount} ن</div>
              </div>
            ))}
            {transactions.length === 0 && <div className="flex flex-col items-center justify-center py-20 opacity-20"><Inbox size={48} className="mb-4" /><p className="font-black text-sm">لا توجد عمليات</p></div>}
          </div>
        </div>
      </div>
    </div>
  );

  const renderNetworks = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map(agent => (
          <div key={agent.id} className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 hover:shadow-2xl transition-all group">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Wifi size={40} className="text-indigo-600" />
            </div>
            <h3 className="font-black text-xl mb-2">{agent.networkName}</h3>
            <p className="text-xs text-slate-400 font-bold mb-6">الوكيل: {agent.fullName}</p>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {agent.contacts && agent.contacts.filter(c => c.isActive).length > 0 ? (
                agent.contacts.filter(c => c.isActive).map(contact => (
                  <a 
                    key={contact.id}
                    href={
                      contact.type === 'whatsapp' ? `https://wa.me/${contact.value}` :
                      contact.type === 'phone' ? `tel:${contact.value}` :
                      `mailto:${contact.value}`
                    }
                    target={contact.type === 'email' ? '_self' : '_blank'}
                    rel="noreferrer"
                    className={cn(
                      "p-3 rounded-xl transition-all hover:text-white",
                      contact.type === 'whatsapp' ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-600" :
                      contact.type === 'phone' ? "bg-blue-50 text-blue-600 hover:bg-blue-600" :
                      "bg-slate-50 text-slate-600 hover:bg-slate-600"
                    )}
                    title={contact.value}
                  >
                    {contact.type === 'whatsapp' ? <MessageCircle size={18} /> : 
                     contact.type === 'phone' ? <Phone size={18} /> : 
                     <Mail size={18} />}
                  </a>
                ))
              ) : (
                <>
                  <a href={`https://wa.me/${agent.phone}`} target="_blank" rel="noreferrer" className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><MessageCircle size={18} /></a>
                  <a href={`tel:${agent.phone}`} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Phone size={18} /></a>
                  <a href={`mailto:support@almajed.store`} className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-600 hover:text-white transition-all"><Mail size={18} /></a>
                </>
              )}
            </div>

            <button onClick={() => setSelectedAgent(agent)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:scale-[1.02] active:scale-95 transition-all">عرض الباقات 🛒</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPointsStore = () => {
    const packages = [
      { id: 'p1', name: 'باقة 500 نقطة', points: 500, price: 500 },
      { id: 'p2', name: 'باقة 1000 نقطة', points: 1000, price: 950 },
      { id: 'p3', name: 'باقة 2500 نقطة', points: 2500, price: 2300 },
      { id: 'p4', name: 'باقة 5000 نقطة', points: 5000, price: 4500 },
    ];

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map(pkg => (
            <div key={pkg.id} className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 flex flex-col items-center text-center group hover:shadow-2xl transition-all">
              <div className="w-20 h-20 bg-amber-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform">
                <Gift size={40} className="text-amber-500" />
              </div>
              <h4 className="font-black text-lg mb-2">{pkg.name}</h4>
              <p className="text-2xl font-black text-indigo-600 mb-2">{pkg.price} ريال</p>
              <p className="text-[10px] text-slate-400 font-bold mb-6">تحصل على {pkg.points} نقطة فوراً</p>
              <button onClick={() => { StorageService.updateUser(user.id, { pointsBalance: user.pointsBalance + pkg.points }); showNotification(`تم شراء ${pkg.points} نقطة بنجاح ✅`); onUpdate(); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl">شراء الآن 🎁</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMyCards = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card rounded-[2.5rem] border bg-white dark:bg-white/5 overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[400px] no-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2">الشبكة</th>
                <th className="px-3 py-2">الباقة × العدد</th>
                <th className="px-3 py-2">الكود</th>
                <th className="px-3 py-2">تاريخ الشراء</th>
                <th className="px-3 py-2">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/5">
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                  <td className="px-3 py-2 text-xs font-black">{o.networkName}</td>
                  <td className="px-3 py-2 text-xs font-black">{o.categoryName} × 1</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <code className="font-mono text-indigo-600 font-black tracking-widest bg-indigo-50 dark:bg-indigo-600/10 px-3 py-1 rounded-lg">
                        {revealedCodes[o.id] ? StorageService.decryptCardCode(o.cardNumber) : '********'}
                      </code>
                      <button onClick={() => setRevealedCodes(prev => ({ ...prev, [o.id]: !prev[o.id] }))} className="text-slate-400 hover:text-indigo-600 transition-colors">
                        {revealedCodes[o.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(StorageService.decryptCardCode(o.cardNumber)); showNotification('تم نسخ الكود ✅'); }} className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <Copy size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs font-black text-slate-500">{new Date(o.createdAt).toLocaleDateString('ar-YE')}</td>
                  <td className="px-3 py-2"><span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black">ناجحة</span></td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center opacity-20">
                    <Inbox size={48} className="mx-auto mb-4" />
                    <p className="font-black text-sm">لا توجد كروت مشتراة بعد</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderTopup = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card p-10 rounded-[3rem] border bg-white dark:bg-white/5 space-y-8 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banks.map(b => (
            <div key={b.id} onClick={() => setTopupForm({...topupForm, method: b.bankName})} className={cn("p-6 rounded-[2rem] border-2 transition-all cursor-pointer group", topupForm.method === b.bankName ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-600/10" : "border-slate-100 dark:border-white/5 hover:border-indigo-200")}>
              <h4 className="font-black text-sm mb-1">{b.bankName}</h4>
              <p className="text-[10px] text-slate-400 font-bold mb-4">{b.accountHolder}</p>
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-white/5 p-3 rounded-xl border dark:border-white/10">
                <code className="text-xs font-black text-indigo-600 tracking-widest">{b.accountNumber}</code>
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(b.accountNumber); showNotification('تم نسخ الحساب ✅'); }} className="text-slate-400 group-hover:text-indigo-600"><Copy size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="relative">
            <PlusCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="number" placeholder="عدد النقاط" value={topupForm.amount} onChange={e => setTopupForm({...topupForm, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 p-5 pr-12 rounded-2xl border dark:border-white/10 font-black text-sm outline-none focus:border-indigo-600 transition-all" />
          </div>
          <div className="relative">
            <FileText className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="رقم المرجع / الحوالة" value={topupForm.ref} onChange={e => setTopupForm({...topupForm, ref: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 p-5 pr-12 rounded-2xl border dark:border-white/10 font-black text-sm outline-none focus:border-indigo-600 transition-all" />
          </div>
          <div className="relative">
            <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="اسم المودع" value={topupForm.client} onChange={e => setTopupForm({...topupForm, client: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 p-5 pr-12 rounded-2xl border dark:border-white/10 font-black text-sm outline-none focus:border-indigo-600 transition-all" />
          </div>
          <button onClick={() => { StorageService.createPointsRequest(user.id, user.fullName, parseInt(topupForm.amount), topupForm.method, topupForm.ref, topupForm.client); showNotification('تم إرسال طلب الشحن بنجاح وهو قيد المراجعة ✅'); setTopupForm({ amount: '', method: '', ref: '', client: '' }); }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all">إرسال طلب الشحن 🚀</button>
        </div>
      </div>
    </div>
  );

  const renderTransfer = () => (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card p-12 rounded-[4rem] border bg-white dark:bg-white/5 space-y-8 text-center shadow-2xl">
        <div className="w-28 h-28 bg-indigo-50 dark:bg-white/5 text-indigo-600 rounded-[3rem] flex items-center justify-center mx-auto text-4xl shadow-xl shadow-indigo-100 dark:shadow-none"><Send size={48} /></div>
        <div>
          <h3 className="text-3xl font-black mb-3">تحويل رصيد فوري</h3>
          <p className="text-sm text-slate-400 font-bold leading-relaxed px-4">قم بتحويل النقاط لأي مستخدم آخر في الماجد ستور فوراً وبأمان تام.</p>
        </div>
        <div className="space-y-5">
          <div className="relative">
            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="رقم هاتف المستلم" value={transferForm.phone} onChange={e => setTransferForm({...transferForm, phone: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 p-5 pr-12 rounded-2xl border dark:border-white/10 font-black text-sm outline-none text-center focus:border-indigo-600 transition-all" />
          </div>
          <div className="relative">
            <Wallet className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="number" placeholder="كمية النقاط" value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 p-5 pr-12 rounded-2xl border dark:border-white/10 font-black text-sm outline-none text-center focus:border-indigo-600 transition-all" />
          </div>
          <button onClick={() => { 
            const res = StorageService.transferPoints(user.id, transferForm.phone, parseInt(transferForm.amount)); 
            if (res === true) {
              showNotification('تم التحويل بنجاح ✅'); 
              setTransferForm({ phone: '', amount: '' }); 
              onUpdate(); 
            } else {
              showNotification(res as string, 'error');
            }
          }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all">تأكيد التحويل الآن ⚡</button>
        </div>
      </div>
    </div>
  );

  const renderStatement = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-3xl font-black mb-1">كشف الحساب</h3>
          <p className="text-xs text-slate-400 font-bold">تتبع جميع حركات رصيدك المالية</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-white dark:bg-white/5 p-1 rounded-2xl border dark:border-white/10 shadow-sm">
            {['all', 'purchase', 'deposit', 'transfer'].map(type => (
              <button key={type} onClick={() => setTxTypeFilter(type as any)} className={cn("px-5 py-2 rounded-xl text-[10px] font-black transition-all", txTypeFilter === type ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" : "text-slate-400 hover:text-indigo-600")}>
                {type === 'all' ? 'الكل' : type === 'purchase' ? 'المشتريات' : type === 'deposit' ? 'الشحن' : 'التحويلات'}
              </button>
            ))}
          </div>
          <button onClick={exportPDF} className="flex items-center gap-2 px-6 py-3 bg-indigo-950 text-white rounded-2xl font-black text-[10px] shadow-xl hover:bg-indigo-900 transition-all">
            <Download size={16} /> تحميل تقرير (PDF)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-6 rounded-3xl border bg-white dark:bg-white/5 flex items-center gap-4">
          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-400"><Calendar size={20} /></div>
          <div className="flex-1">
            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">من تاريخ</p>
            <input type="date" value={dateFilter.from} onChange={e => setDateFilter({...dateFilter, from: e.target.value})} className="w-full bg-transparent font-black text-xs outline-none" />
          </div>
        </div>
        <div className="glass-card p-6 rounded-3xl border bg-white dark:bg-white/5 flex items-center gap-4">
          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-400"><Calendar size={20} /></div>
          <div className="flex-1">
            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">إلى تاريخ</p>
            <input type="date" value={dateFilter.to} onChange={e => setDateFilter({...dateFilter, to: e.target.value})} className="w-full bg-transparent font-black text-xs outline-none" />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[3rem] border bg-white dark:bg-white/5 overflow-hidden shadow-xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[400px] no-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2">التاريخ</th>
                <th className="px-3 py-2">النوع</th>
                <th className="px-3 py-2">التفاصيل</th>
                <th className="px-3 py-2">المبلغ</th>
                <th className="px-3 py-2">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/5">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                  <td className="px-3 py-2 text-xs font-black text-slate-500">{new Date(tx.date).toLocaleDateString('ar-YE')}</td>
                  <td className="px-3 py-2">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black", 
                      tx.amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                      {tx.type === 'purchase' ? 'مشتريات' : tx.type === 'deposit' ? 'شحن' : tx.type === 'transfer_in' ? 'استلام' : 'تحويل'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs font-black">{tx.details}</td>
                  <td className="px-3 py-2 font-black">{tx.amount > 0 ? '+' : ''}{tx.amount} ن</td>
                  <td className="px-3 py-2 font-black text-slate-400">{tx.balanceAfter} ن</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center opacity-20">
                    <Inbox size={48} className="mx-auto mb-4" />
                    <p className="font-black text-sm">لا توجد عمليات تطابق الفلترة</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card p-10 rounded-[3rem] border bg-white dark:bg-white/5 space-y-10 shadow-xl">
        <div className="flex items-center gap-8 pb-10 border-b dark:border-white/5">
          <div className="w-28 h-28 bg-slate-100 dark:bg-white/5 rounded-[3rem] flex items-center justify-center text-6xl shadow-inner">👤</div>
          <div>
            <h3 className="text-3xl font-black mb-1">{user.fullName}</h3>
            <p className="text-sm text-slate-400 font-bold">{user.phone}</p>
            <div className="mt-4 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black w-fit">مستخدم معتمد ✅</div>
          </div>
        </div>
        <div className="space-y-8">
          <div>
            <h4 className="font-black text-xl mb-2">تغيير كلمة المرور</h4>
            <p className="text-xs text-slate-400 font-bold">يرجى استخدام كلمة مرور قوية لحماية حسابك</p>
          </div>
          <div className="space-y-5">
            <div className="relative">
              <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input type="password" placeholder="كلمة المرور الجديدة" value={passForm.new} onChange={(e) => setPassForm(p => ({ ...p, new: e.target.value }))} className="w-full bg-slate-50 dark:bg-white/5 border dark:border-white/10 p-5 pr-12 rounded-2xl font-black text-sm outline-none focus:border-indigo-600 transition-all" />
            </div>
            <div className="relative">
              <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input type="password" placeholder="تأكيد كلمة المرور" value={passForm.confirm} onChange={(e) => setPassForm(p => ({ ...p, confirm: e.target.value }))} className="w-full bg-slate-50 dark:bg-white/5 border dark:border-white/10 p-5 pr-12 rounded-2xl font-black text-sm outline-none focus:border-indigo-600 transition-all" />
            </div>
            <button onClick={() => { 
              if (passForm.new !== passForm.confirm) return showNotification('كلمات المرور غير متطابقة', 'error');
              StorageService.updatePassword(user.id, passForm.new); 
              showNotification('تم تحديث كلمة السر بنجاح ✨'); 
              setPassForm({ new: '', confirm: '' }); 
            }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all">تحديث كلمة السر ✨</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderShare = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
      <div className="glass-card p-16 rounded-[5rem] border bg-white dark:bg-white/5 space-y-10 shadow-2xl">
        <div className="w-32 h-32 bg-indigo-50 dark:bg-white/5 text-indigo-600 rounded-[3.5rem] flex items-center justify-center mx-auto text-6xl shadow-xl shadow-indigo-100 dark:shadow-none"><Share2 size={64} /></div>
        <div>
          <h3 className="text-4xl font-black mb-4">شارك التطبيق واربح!</h3>
          <p className="text-sm text-slate-500 font-bold leading-relaxed px-6">شارك رابط تطبيق الماجد ستور مع أصدقائك واحصل على نقاط مجانية عند كل عملية شحن يقومون بها.</p>
        </div>
        <div className="p-8 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-indigo-200 dark:border-white/10">
          <p className="text-[10px] text-slate-400 font-black uppercase mb-4 tracking-widest">رابط المشاركة الخاص بك</p>
          <div className="flex items-center gap-4">
            <code className="flex-1 text-xs font-black text-indigo-600 truncate bg-white dark:bg-white/5 p-4 rounded-xl border dark:border-white/10">https://wifi-quantum.netlify.app</code>
            <button onClick={() => { navigator.clipboard.writeText(`https://wifi-quantum.netlify.app`); showNotification('تم نسخ الرابط بنجاح ✅'); }} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg hover:scale-110 transition-all active:scale-90"><Copy size={20} /></button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[MessageCircle, Facebook, Twitter, Instagram].map((Icon, i) => (
            <button key={i} className="w-full aspect-square rounded-3xl flex items-center justify-center text-white text-xl shadow-xl bg-indigo-600 hover:scale-110 transition-all active:scale-90"><Icon size={28} /></button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTickets = () => {
    const filteredTickets = tickets.filter(t => {
      if (ticketDateFilter === 'all') return true;
      const date = new Date(t.createdAt);
      const now = new Date();
      if (ticketDateFilter === 'today') return date.toDateString() === now.toDateString();
      if (ticketDateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return date >= weekAgo;
      }
      if (ticketDateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return date >= monthAgo;
      }
      return true;
    });

    const handleCreateTicket = async () => {
      if (!ticketForm.title || !ticketForm.message) {
        return showNotification('يرجى ملء جميع الحقول', 'error');
      }

      const recipientAgent = agents.find(a => a.id === user.referredBy);
      const recipientName = ticketForm.recipient === 'ADMIN' ? 'الإدارة العامة' : (recipientAgent?.networkName || 'الوكيل');
      
      const newTicket = StorageService.createSupportTicket({
        userId: user.id,
        userName: user.fullName,
        userPhone: user.phone,
        title: ticketForm.title,
        message: ticketForm.message,
        recipientType: ticketForm.recipient as 'ADMIN' | 'AGENT',
        recipientId: ticketForm.recipient === 'AGENT' ? user.referredBy : undefined,
        recipientName
      });

      showNotification('تم إرسال التذكرة بنجاح ✅');
      setTicketForm({ title: '', message: '', recipient: 'ADMIN' });
      refreshData();
    };

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Ticket Form */}
          <div className="lg:col-span-1 glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 h-fit">
            <h3 className="font-black text-xl mb-6 flex items-center gap-2">
              <PlusCircle className="text-indigo-600" />
              فتح تذكرة جديدة
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">جهة التواصل</label>
                <select 
                  value={ticketForm.recipient} 
                  onChange={e => setTicketForm({...ticketForm, recipient: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border dark:border-white/10 font-black text-xs outline-none focus:border-indigo-600 transition-all"
                >
                  <option value="ADMIN">الإدارة العامة</option>
                  {user.referredBy && <option value="AGENT">الوكيل الخاص بي</option>}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">عنوان المشكلة</label>
                <input 
                  type="text" 
                  placeholder="مثال: مشكلة في شحن الرصيد"
                  value={ticketForm.title}
                  onChange={e => setTicketForm({...ticketForm, title: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border dark:border-white/10 font-black text-xs outline-none focus:border-indigo-600 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">تفاصيل المشكلة</label>
                <textarea 
                  rows={4}
                  placeholder="اشرح المشكلة بالتفصيل..."
                  value={ticketForm.message}
                  onChange={e => setTicketForm({...ticketForm, message: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border dark:border-white/10 font-black text-xs outline-none focus:border-indigo-600 transition-all resize-none"
                />
              </div>
              <button 
                onClick={handleCreateTicket}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
              >
                إرسال التذكرة 🚀
              </button>
            </div>
          </div>

          {/* Tickets List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-xl">التذاكر السابقة</h3>
              <div className="flex bg-white dark:bg-white/5 p-1 rounded-2xl border dark:border-white/10 shadow-sm">
                {['all', 'today', 'week', 'month'].map(period => (
                  <button 
                    key={period} 
                    onClick={() => setTicketDateFilter(period)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
                      ticketDateFilter === period ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" : "text-slate-400 hover:text-indigo-600"
                    )}
                  >
                    {period === 'all' ? 'الكل' : period === 'today' ? 'اليوم' : period === 'week' ? 'الأسبوع' : 'الشهر'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {filteredTickets.map(ticket => (
                <div key={ticket.id} className="glass-card p-6 rounded-[2.5rem] border bg-white dark:bg-white/5 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-sm mb-1">{ticket.title}</h4>
                      <p className="text-[10px] text-slate-400 font-bold">إلى: {ticket.recipientName} • {new Date(ticket.createdAt).toLocaleDateString('ar-YE')}</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black",
                      ticket.status === TicketStatus.OPEN ? "bg-indigo-50 text-indigo-600" :
                      ticket.status === TicketStatus.IN_PROGRESS ? "bg-amber-50 text-amber-600" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {ticket.status === TicketStatus.OPEN ? 'مفتوحة' :
                       ticket.status === TicketStatus.IN_PROGRESS ? 'قيد المعالجة' : 'مغلقة'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">{ticket.message}</p>
                  
                  {ticket.replies && ticket.replies.length > 0 && (
                    <div className="mt-4 pt-4 border-t dark:border-white/5 space-y-3">
                      {ticket.replies.map((reply, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-8 h-8 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-xs">👤</div>
                          <div className="flex-1 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl">
                            <p className="text-[10px] font-black text-indigo-600 mb-1">{reply.senderName}</p>
                            <p className="text-[10px] text-slate-600 dark:text-slate-300">{reply.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredTickets.length === 0 && (
                <div className="glass-card p-20 rounded-[3rem] border bg-white dark:bg-white/5 text-center opacity-20">
                  <Icons.Ticket size={48} className="mx-auto mb-4" />
                  <p className="font-black text-sm">لا توجد تذاكر دعم حالياً</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home': return renderHome();
      case 'networks': return renderNetworks();
      case 'points_store': return renderPointsStore();
      case 'my_cards': return renderMyCards();
      case 'topup': return renderTopup();
      case 'transfer': return renderTransfer();
      case 'statement': return renderStatement();
      case 'tickets': return renderTickets();
      case 'settings': return renderSettings();
      case 'share': return renderShare();
      default: return renderHome();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-indigo-950/20 flex flex-row-reverse">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-50 w-72 bg-white dark:bg-indigo-950 border-l border-slate-200 dark:border-white/5 transition-transform duration-300 lg:translate-x-0 lg:static",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-200 dark:shadow-none">A</div>
            <h1 className="font-black text-xl tracking-tight text-indigo-950 dark:text-white">الماجد ستور</h1>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4 rounded-[1.5rem] font-black text-xs transition-all",
                    activeSection === item.id 
                      ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-100 dark:shadow-none" 
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-8 border-t dark:border-white/5">
            <button 
              onClick={() => { StorageService.logout(); window.location.reload(); }}
              className="w-full flex items-center gap-4 px-6 py-5 rounded-[1.5rem] font-black text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20"
            >
              <LogOut size={20} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white dark:bg-indigo-950 p-5 border-b dark:border-white/5 flex justify-between items-center sticky top-0 z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 dark:text-white">
            <Menu size={24} />
          </button>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl">A</div>
        </header>

        <div className="w-full m-0 p-2 space-y-10">
          {/* Search Bar */}
          <div className="relative group">
            <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
              <Icons.Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="بحث في العمليات، الشبكات، أو الكروت..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-5 pr-14 rounded-[2rem] font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 left-0 pl-5 flex items-center text-slate-400 hover:text-rose-500"
              >
                <Icons.X size={20} />
              </button>
            )}
          </div>

          {/* Top Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {menuItems.find(m => m.id === activeSection)?.label.replace(/[^أ-ي ]/g, '').trim()}
              </h2>
              <p className="text-slate-400 font-bold text-xs mt-2">تصفح القسم وإدارة بياناتك المالية</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="glass-card px-8 py-4 rounded-3xl border bg-white dark:bg-white/5 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الرصيد الحالي</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{user.pointsBalance} <span className="text-xs opacity-50">نقطة</span></p>
                </div>
              </div>
              <button onClick={() => setActiveSection('topup')} className="bg-indigo-600 text-white p-5 rounded-3xl shadow-2xl shadow-indigo-200 dark:shadow-none hover:scale-110 transition-all active:scale-95">
                <ArrowUpRight size={24} />
              </button>
            </div>
          </div>

          {/* Section Content */}
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[4rem] p-10 text-center relative overflow-hidden shadow-2xl">
            <button onClick={() => setShowQRModal(false)} className="absolute top-8 right-8 p-3 bg-slate-100 dark:bg-white/5 rounded-full hover:rotate-90 transition-all"><X size={24} /></button>
            <h3 className="text-2xl font-black mb-8">رمز QR الخاص بك</h3>
            <div className="bg-white p-8 rounded-[3rem] inline-block mb-8 shadow-2xl border-4 border-indigo-600">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${user.id}`} alt="QR Code" className="w-56 h-56" />
            </div>
            <p className="text-sm text-slate-400 font-bold mb-10 leading-relaxed">استخدم هذا الكود للشحن السريع أو التحويل بين الحسابات في الماجد ستور.</p>
            <button onClick={() => window.print()} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-2xl shadow-indigo-200 dark:shadow-none">تحميل الكود 📥</button>
          </div>
        </div>
      )}

      {/* Agent Packages Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[4rem] p-10 relative overflow-hidden max-h-[90vh] flex flex-col shadow-2xl">
            <button onClick={() => setSelectedAgent(null)} className="absolute top-8 right-8 p-3 bg-slate-100 dark:bg-white/5 rounded-full z-10 hover:rotate-90 transition-all"><X size={24} /></button>
            <div className="flex items-center gap-6 mb-10">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-indigo-600 shadow-inner"><Wifi size={40} /></div>
              <div>
                <h3 className="text-3xl font-black">{selectedAgent.networkName}</h3>
                <p className="text-sm text-slate-400 font-bold">اختر الفئة والكمية المطلوبة من باقات الشبكة</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pr-2">
              {filteredCategories.filter(c => c.agentId === selectedAgent.id).map(cat => (
                <div key={cat.id} className="glass-card p-8 rounded-[2.5rem] border bg-white dark:bg-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-indigo-600 transition-all">
                  <div className="flex-1 text-center md:text-right">
                    <h4 className="font-black text-xl mb-1">{cat.name}</h4>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-2">
                      <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black">{cat.pointsPrice} نقطة</span>
                      <span className="px-3 py-1 bg-slate-50 dark:bg-white/5 text-slate-400 rounded-full text-[10px] font-black">{cat.dataSize}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-2xl p-1.5 border dark:border-white/10">
                      <button onClick={() => setQtyMap(prev => ({ ...prev, [cat.id]: Math.max(1, (prev[cat.id] || 1) - 1) }))} className="w-10 h-10 flex items-center justify-center font-black text-xl hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all">-</button>
                      <span className="w-12 text-center font-black text-lg">{qtyMap[cat.id] || 1}</span>
                      <button onClick={() => setQtyMap(prev => ({ ...prev, [cat.id]: (prev[cat.id] || 1) + 1 }))} className="w-10 h-10 flex items-center justify-center font-black text-xl hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all">+</button>
                    </div>
                    <button onClick={() => setShowConfirm({ cat, qty: qtyMap[cat.id] || 1 })} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all">شراء 🛒</button>
                  </div>
                </div>
              ))}
              {categories.filter(c => c.agentId === selectedAgent.id).length === 0 && (
                <div className="py-20 text-center opacity-20">
                  <Inbox size={48} className="mx-auto mb-4" />
                  <p className="font-black text-sm">لا توجد باقات متاحة حالياً لهذه الشبكة</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[4rem] p-12 text-center shadow-2xl border border-white/10">
            <div className="w-24 h-24 bg-amber-50 dark:bg-white/5 text-amber-500 rounded-[3rem] flex items-center justify-center mx-auto mb-8 text-5xl shadow-inner">❓</div>
            <h3 className="text-3xl font-black mb-4">تأكيد عملية الشراء</h3>
            <p className="text-sm text-slate-500 font-bold mb-10 leading-relaxed px-4">
              هل أنت متأكد من شراء <span className="text-indigo-600">{showConfirm.qty}</span> كرت من فئة <span className="text-indigo-600">{showConfirm.cat.name}</span>؟ 
              سيتم خصم <span className="text-rose-600">{showConfirm.cat.pointsPrice * showConfirm.qty}</span> نقطة من رصيدك فوراً.
            </p>
            <div className="flex gap-4">
              <button onClick={handleBuy} className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-2xl shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all">تأكيد الشراء ✅</button>
              <button onClick={() => setShowConfirm(null)} className="flex-1 py-5 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-[2rem] font-black text-sm hover:bg-slate-200 transition-all">إلغاء ❌</button>
            </div>
          </div>
        </div>
      )}
    </div>
    {/* قسم الإشعارات الجديد */}
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="text-blue-500">🔔</span> الإشعارات الأخيرة
                    </h3>
                        <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full font-medium">
                              3 جديدة
                                  </span>
                                    </div>

                                      <div className="divide-y divide-gray-50">
                                          {/* إشعار 1 */}
                                              <div className="p-4 hover:bg-blue-50 transition-colors cursor-pointer">
                                                    <div className="flex gap-3">
                                                            <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                                    <div>
                                                                              <p className="text-sm text-gray-800 font-medium">تم تحديث باقة الإنترنت الخاصة بك بنجاح.</p>
                                                                                        <p className="text-xs text-gray-400 mt-1">منذ 5 دقائق</p>
                                                                                                </div>
                                                                                                      </div>
                                                                                                          </div>

                                                                                                              {/* إشعار 2 */}
                                                                                                                  <div className="p-4 hover:bg-blue-50 transition-colors cursor-pointer">
                                                                                                                        <div className="flex gap-3">
                                                                                                                                <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full"></div>
                                                                                                                                        <div>
                                                                                                                                                  <p className="text-sm text-gray-800 font-medium">لقد حصلت على 50 نقطة مكافأة جديدة!</p>
                                                                                                                                                            <p className="text-xs text-gray-400 mt-1">منذ ساعتين</p>
                                                                                                                                                                    </div>
                                                                                                                                                                          </div>
                                                                                                                                                                              </div>

                                                                                                                                                                                  {/* إشعار 3 */}
                                                                                                                                                                                      <div className="p-4 bg-gray-50/50">
                                                                                                                                                                                            <div className="flex gap-3 opacity-60">
                                                                                                                                                                                                    <div className="w-2 h-2 mt-2 bg-gray-300 rounded-full"></div>
                                                                                                                                                                                                            <div>
                                                                                                                                                                                                                      <p className="text-sm text-gray-700">مرحباً بك في لوحة تحكم كوانتوم واي فاي.</p>
                                                                                                                                                                                                                                <p className="text-xs text-gray-400 mt-1">أمس في 10:30 م</p>
                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                    </div>

                                                                                                                                                                                                                                                      <button className="w-full py-3 text-sm text-blue-600 font-medium hover:bg-blue-50 border-t border-gray-100 transition-all">
                                                                                                                                                                                                                                                          عرض كافة الإشعارات
                                                                                                                                                                                                                                                            </button>
                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                            
  );
};

export default UserDashboard;
