
import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Category, Order, Agent, BankAccount, 
  CardStatus, Status, PointRequest 
} from '../types';
import { StorageService } from '../services/storage';
import { useNotification } from '../components/Layout';
import { 
  Search, Download, Eye, EyeOff, Copy, Wallet, 
  History, CreditCard, Bell, LifeBuoy, BarChart3, 
  ArrowUpRight, ArrowDownLeft, Filter, ChevronLeft, ChevronRight,
  Star, Info, CheckCircle2, AlertCircle, Menu, X, LogOut, Settings,
  ShoppingBag, Heart, MessageSquare, PieChart as PieChartIcon,
  User as UserIcon, Lock, Share2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UserDashboardProps {
  user: User;
  onUpdate: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, onUpdate }) => {
  const { showNotification } = useNotification();
  const [activeSection, setActiveSection] = useState<'home' | 'wallet' | 'transactions' | 'favorites' | 'support' | 'reports' | 'settings'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Data State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deposits, setDeposits] = useState<PointRequest[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [systemSettings, setSystemSettings] = useState(StorageService.getSystemSettings());
  
  // UI State
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ cat: Category, qty: number } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'purchase' | 'deposit'>('all');
  const [txDateFilter, setTxDateFilter] = useState('');
  
  // Forms
  const [topupForm, setTopupForm] = useState({ amount: '', method: '', ref: '', client: '' });
  const [passForm, setPassForm] = useState({ new: '', confirm: '' });
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  const refreshData = () => {
    const allAgents = StorageService.getAgents().filter(a => a.isActive);
    setAgents(allAgents);
    setOrders(StorageService.getOrders(user.id, user.role));
    setDeposits(StorageService.getUserDeposits(user.id));
    setNotifications(StorageService.getNotifications(user.id));
    setBanks(StorageService.getBankAccounts().filter(b => b.isActive));
    setSystemSettings(StorageService.getSystemSettings());

    // Stock calculation
    const allCards = JSON.parse(localStorage.getItem('qw_kroot_v2') || '[]');
    const counts: Record<string, number> = {};
    allCards.forEach((k: any) => {
      if (k.status === CardStatus.AVAILABLE) {
        counts[k.categoryId] = (counts[k.categoryId] || 0) + 1;
      }
    });
    setStockMap(counts);
  };

  useEffect(() => {
    refreshData();
  }, [user.id, user.pointsBalance]);

  // Derived Data
  const favoriteAgents = useMemo(() => {
    return agents.filter(a => user.favorites?.includes(a.id));
  }, [agents, user.favorites]);

  const transactions = useMemo(() => {
    const combined = [
      ...orders.map(o => ({
        id: o.id,
        date: o.createdAt,
        type: 'purchase' as const,
        title: `شراء كرت ${o.networkName}`,
        detail: o.categoryName,
        amount: -o.pointsUsed,
        status: o.status,
        ref: StorageService.decryptCardCode(o.cardNumber!)
      })),
      ...deposits.map(d => ({
        id: d.id,
        date: d.createdAt,
        type: 'deposit' as const,
        title: `شحن رصيد (${d.paymentMethod})`,
        detail: d.recipientName,
        amount: d.amount,
        status: d.status,
        ref: d.referenceNumber
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return combined.filter(t => {
      const matchType = txTypeFilter === 'all' || t.type === txTypeFilter;
      const matchDate = !txDateFilter || t.date.startsWith(txDateFilter);
      const matchSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.ref.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchDate && matchSearch;
    });
  }, [orders, deposits, txTypeFilter, txDateFilter, searchQuery]);

  // Handlers
  const handleBuy = async () => {
    if (!showConfirm) return;
    const res = await StorageService.createOrder(user.id, showConfirm.cat.id, showConfirm.qty);
    if (typeof res === 'string') {
      showNotification(res, 'error');
    } else {
      showNotification('تمت عملية الشراء بنجاح! ✅', 'success');
      onUpdate();
      setShowConfirm(null);
      refreshData();
    }
  };

  const handleUpdatePassword = () => {
    if (!passForm.new || passForm.new !== passForm.confirm) {
      return showNotification('كلمات المرور غير متطابقة', 'error');
    }
    StorageService.updatePassword(user.id, passForm.new);
    showNotification('تم تحديث كلمة المرور بنجاح ✅', 'success');
    setPassForm({ new: '', confirm: '' });
  };

  const toggleFavorite = (agentId: string) => {
    StorageService.toggleFavorite(user.id, agentId);
    onUpdate();
    refreshData();
  };

  const exportCSV = () => {
    const headers = ['التاريخ', 'النوع', 'البيان', 'المبلغ', 'الحالة', 'المرجع'];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleString('ar-YE'),
      t.type === 'purchase' ? 'شراء' : 'شحن',
      t.title,
      t.amount,
      t.status,
      t.ref
    ]);
    
    const csvContent = "\uFEFF" + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_${user.fullName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Components
  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 flex items-center gap-4 shadow-sm">
      <div className={cn("p-4 rounded-2xl", color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-xl font-black text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-indigo-950/20 flex flex-row-reverse">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-50 w-72 bg-white dark:bg-indigo-950 border-l border-slate-200 dark:border-white/5 transition-transform duration-300 lg:translate-x-0 lg:static",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">Q</div>
            <h1 className="font-black text-xl tracking-tight text-indigo-900 dark:text-white">كوانتوم واي فاي</h1>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { id: 'home', label: 'الرئيسية', icon: ShoppingBag },
              { id: 'wallet', label: 'محفظتي', icon: Wallet },
              { id: 'transactions', label: 'سجل العمليات', icon: History },
              { id: 'favorites', label: 'الشبكات المفضلة', icon: Heart },
              { id: 'reports', label: 'التقارير', icon: BarChart3 },
              { id: 'support', label: 'الدعم الفني', icon: LifeBuoy },
              { id: 'settings', label: 'الإعدادات', icon: Settings },
            ].map((item: any) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setIsSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-4 rounded-[1.5rem] font-black text-xs transition-all",
                  activeSection === item.id 
                    ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none" 
                    : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                )}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t dark:border-white/5">
            <button 
              onClick={() => { StorageService.logout(); window.location.reload(); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-[1.5rem] font-black text-xs text-rose-500 hover:bg-rose-50 transition-all"
            >
              <LogOut size={18} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white dark:bg-indigo-950 p-4 border-b dark:border-white/5 flex justify-between items-center sticky top-0 z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 dark:text-white">
            <Menu size={24} />
          </button>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black">Q</div>
        </header>

        <div className="p-4 lg:p-10 max-w-7xl mx-auto space-y-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {activeSection === 'home' && 'مرحباً بك، ' + user.fullName.split(' ')[0] + ' 👋'}
                {activeSection === 'wallet' && 'محفظتي الإلكترونية'}
                {activeSection === 'transactions' && 'سجل العمليات'}
                {activeSection === 'favorites' && 'الشبكات المفضلة'}
                {activeSection === 'reports' && 'تقارير الاستخدام'}
                {activeSection === 'support' && 'مركز الدعم'}
                {activeSection === 'settings' && 'إعدادات الحساب'}
              </h2>
              <p className="text-slate-500 font-bold text-xs mt-1">
                {activeSection === 'home' && 'تصفح الشبكات المتاحة وابدأ التسوق الآن'}
                {activeSection === 'wallet' && 'إدارة رصيدك وعمليات الشحن'}
                {activeSection === 'transactions' && 'متابعة كافة تحركات حسابك المالية'}
                {activeSection === 'favorites' && 'الوصول السريع لشبكاتك المفضلة'}
                {activeSection === 'reports' && 'نظرة تحليلية على نشاطك'}
                {activeSection === 'support' && 'نحن هنا لمساعدتك في أي وقت'}
                {activeSection === 'settings' && 'تحديث بيانات الأمان والخصوصية'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="glass-card px-6 py-3 rounded-2xl border bg-white dark:bg-white/5 flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center justify-center">
                  <Wallet size={16} />
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">الرصيد</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{user.pointsBalance} <span className="text-[10px] opacity-50">نقطة</span></p>
                </div>
              </div>
              <button onClick={() => setShowPointsModal(true)} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 hover:scale-105 transition-all active:scale-95">
                <ArrowUpRight size={20} />
              </button>
            </div>
          </div>

          {/* Home Section (Shopping) */}
          {activeSection === 'home' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="إجمالي المشتريات" value={`${orders.length} كرت`} icon={ShoppingBag} color="bg-indigo-50 text-indigo-600" />
                <StatCard title="إجمالي الشحن" value={`${deposits.reduce((s, d) => s + (d.status === Status.COMPLETED ? d.amount : 0), 0)} ن`} icon={ArrowUpRight} color="bg-emerald-50 text-emerald-600" />
                <StatCard title="الشبكات المفضلة" value={`${favoriteAgents.length} شبكة`} icon={Heart} color="bg-rose-50 text-rose-600" />
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Filter size={18} className="text-indigo-600" />
                    الشبكات المتوفرة
                  </h3>
                  <div className="relative w-64">
                    <input 
                      type="text" 
                      placeholder="ابحث عن شبكة..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white dark:bg-white/5 border dark:border-white/10 p-3 pr-10 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <Search size={14} className="absolute right-3 top-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {agents.filter(a => a.networkName.toLowerCase().includes(searchQuery.toLowerCase())).map(agent => (
                    <div key={agent.id} className="glass-card p-6 rounded-[2.5rem] border bg-white dark:bg-white/5 hover:shadow-xl transition-all group relative overflow-hidden">
                      <button 
                        onClick={() => toggleFavorite(agent.id)}
                        className={cn(
                          "absolute top-4 left-4 p-2 rounded-xl transition-all",
                          user.favorites?.includes(agent.id) ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-amber-500"
                        )}
                      >
                        <Star size={18} fill={user.favorites?.includes(agent.id) ? "currentColor" : "none"} />
                      </button>
                      
                      <div className="w-16 h-16 bg-indigo-50 dark:bg-white/5 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">📡</div>
                      <h4 className="font-black text-lg text-slate-900 dark:text-white mb-1">{agent.networkName}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">شبكة واي فاي نشطة</p>
                      
                      <button 
                        onClick={() => { setSelectedAgent(agent); setCategories(StorageService.getCategories(agent.id).filter(c => c.isActive)); }}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95 transition-all"
                      >
                        تصفح الفئات 🛒
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Wallet Section */}
          {activeSection === 'wallet' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="glass-card p-8 rounded-[3rem] bg-indigo-600 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-8xl">💎</div>
                    <p className="text-xs font-black opacity-70 mb-2 uppercase tracking-widest">الرصيد المتاح</p>
                    <div className="text-5xl font-black mb-8">{user.pointsBalance} <span className="text-sm opacity-60">نقطة</span></div>
                    <button onClick={() => setShowPointsModal(true)} className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm shadow-xl hover:scale-[1.02] transition-all active:scale-95">شحن رصيد الآن +</button>
                  </div>

                  <div className="glass-card p-6 rounded-[2.5rem] border bg-white dark:bg-white/5 space-y-4">
                    <h4 className="font-black text-sm border-b dark:border-white/5 pb-2">نصائح الأمان</h4>
                    <div className="space-y-3">
                      <div className="flex gap-3 text-xs font-bold text-slate-500">
                        <div className="text-indigo-600">🛡️</div>
                        <p>لا تشارك كلمة مرورك مع أي شخص آخر.</p>
                      </div>
                      <div className="flex gap-3 text-xs font-bold text-slate-500">
                        <div className="text-indigo-600">📱</div>
                        <p>تأكد من صحة رقم الحوالة عند طلب الشحن.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">سجل الشحنات الأخيرة</h3>
                  <div className="glass-card rounded-[2rem] border bg-white dark:bg-white/5 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-400">
                          <tr>
                            <th className="p-5">التاريخ</th>
                            <th className="p-5">الطريقة</th>
                            <th className="p-5">المبلغ</th>
                            <th className="p-5">الحالة</th>
                            <th className="p-5">المرجع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                          {deposits.slice(0, 10).map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                              <td className="p-5 text-[10px] text-slate-500">{new Date(d.createdAt).toLocaleDateString('ar-YE')}</td>
                              <td className="p-5">{d.paymentMethod}</td>
                              <td className="p-5 font-black text-indigo-600">{d.amount} ن</td>
                              <td className="p-5">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-black",
                                  d.status === Status.COMPLETED ? "bg-emerald-50 text-emerald-600" :
                                  d.status === Status.REJECTED ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                                )}>
                                  {d.status === Status.COMPLETED ? 'مكتمل' : d.status === Status.REJECTED ? 'مرفوض' : 'قيد المراجعة'}
                                </span>
                              </td>
                              <td className="p-5 font-mono text-[10px] opacity-50">{d.referenceNumber}</td>
                            </tr>
                          ))}
                          {deposits.length === 0 && (
                            <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-bold">لا توجد عمليات شحن سابقة</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transactions Section */}
          {activeSection === 'transactions' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'purchase', label: 'مشتريات' },
                    { id: 'deposit', label: 'شحن رصيد' },
                  ].map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setTxTypeFilter(t.id as any)}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black transition-all",
                        txTypeFilter === t.id ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm" : "text-slate-500"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                  <input 
                    type="date" 
                    value={txDateFilter}
                    onChange={(e) => setTxDateFilter(e.target.value)}
                    className="bg-white dark:bg-white/5 border dark:border-white/10 p-3 rounded-xl text-xs font-bold outline-none flex-1 md:w-40"
                  />
                  <button onClick={exportCSV} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-slate-700 transition-all">
                    <Download size={16} />
                    تصدير CSV
                  </button>
                </div>
              </div>

              <div className="glass-card rounded-[2.5rem] border bg-white dark:bg-white/5 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-400">
                      <tr>
                        <th className="p-5">العملية</th>
                        <th className="p-5">التفاصيل</th>
                        <th className="p-5">المبلغ</th>
                        <th className="p-5">التاريخ</th>
                        <th className="p-5">المرجع / الكود</th>
                        <th className="p-5 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                      {transactions.map((t, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-lg",
                                t.type === 'purchase' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                              )}>
                                {t.type === 'purchase' ? <ShoppingBag size={14} /> : <ArrowUpRight size={14} />}
                              </div>
                              <span>{t.title}</span>
                            </div>
                          </td>
                          <td className="p-5 text-slate-500">{t.detail}</td>
                          <td className={cn("p-5 font-black", t.amount > 0 ? "text-emerald-600" : "text-rose-600")}>
                            {t.amount > 0 ? '+' : ''}{t.amount} ن
                          </td>
                          <td className="p-5 text-[10px] text-slate-400 font-mono" dir="ltr">
                            {new Date(t.date).toLocaleString('ar-YE')}
                          </td>
                          <td className="p-5 font-mono text-[10px]">
                            {t.type === 'purchase' ? (
                              <div className="flex items-center gap-2">
                                <span>{revealed[t.id] ? t.ref : '••••••••'}</span>
                                <button onClick={() => setRevealed({...revealed, [t.id]: !revealed[t.id]})} className="text-indigo-600">
                                  {revealed[t.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                              </div>
                            ) : (
                              <span className="opacity-50">{t.ref}</span>
                            )}
                          </td>
                          <td className="p-5 text-center">
                            <button 
                              onClick={() => { navigator.clipboard.writeText(t.ref); showNotification('تم النسخ ✅'); }}
                              className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-indigo-600 hover:text-white transition-all"
                            >
                              <Copy size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold">لا توجد نتائج مطابقة للبحث</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Favorites Section */}
          {activeSection === 'favorites' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {favoriteAgents.map(agent => (
                <div key={agent.id} className="glass-card p-6 rounded-[2.5rem] border bg-white dark:bg-white/5 hover:shadow-xl transition-all group relative overflow-hidden">
                  <button 
                    onClick={() => toggleFavorite(agent.id)}
                    className="absolute top-4 left-4 p-2 rounded-xl text-amber-500 bg-amber-50"
                  >
                    <Star size={18} fill="currentColor" />
                  </button>
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-white/5 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl mb-4">📡</div>
                  <h4 className="font-black text-lg text-slate-900 dark:text-white mb-1">{agent.networkName}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">شبكة مفضلة</p>
                  <button 
                    onClick={() => { setSelectedAgent(agent); setCategories(StorageService.getCategories(agent.id).filter(c => c.isActive)); setActiveSection('home'); }}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all"
                  >
                    تسوق الآن 🛒
                  </button>
                </div>
              ))}
              {favoriteAgents.length === 0 && (
                <div className="col-span-full py-20 text-center glass-card rounded-[3rem] border-dashed border-2 text-slate-300">
                  <div className="text-6xl mb-4 opacity-20">⭐</div>
                  <h3 className="text-xl font-black">لا توجد شبكات مفضلة بعد</h3>
                  <p className="text-xs font-bold mt-2">قم بتمييز الشبكات التي تستخدمها بكثرة للوصول السريع</p>
                </div>
              )}
            </div>
          )}

          {/* Reports Section */}
          {activeSection === 'reports' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 space-y-6">
                  <h4 className="font-black text-sm flex items-center gap-2">
                    <PieChartIcon size={18} className="text-indigo-600" />
                    توزيع المشتريات حسب الشبكة
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(orders.reduce((acc: any, o) => {
                            acc[o.networkName] = (acc[o.networkName] || 0) + 1;
                            return acc;
                          }, {})).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 space-y-6">
                  <h4 className="font-black text-sm flex items-center gap-2">
                    <BarChart3 size={18} className="text-emerald-600" />
                    إحصائيات النقاط المستهلكة
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(orders.reduce((acc: any, o) => {
                        const date = new Date(o.createdAt).toLocaleDateString('ar-YE');
                        acc[date] = (acc[date] || 0) + o.pointsUsed;
                        return acc;
                      }, {})).map(([date, points]) => ({ date, points })).slice(-7)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="points" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Support Section */}
          {activeSection === 'support' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 text-center space-y-4">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto text-3xl">💬</div>
                  <h4 className="font-black text-lg">تواصل معنا واتساب</h4>
                  <p className="text-xs text-slate-500 font-bold">فريق الدعم الفني متواجد لخدمتك على مدار الساعة</p>
                  <a 
                    href={`https://wa.me/${systemSettings.support?.whatsapp || ''}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-100 dark:shadow-none text-center"
                  >
                    فتح المحادثة الآن ⚡
                  </a>
                </div>
                <div className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 text-center space-y-4">
                  <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto text-3xl">📧</div>
                  <h4 className="font-black text-lg">البريد الإلكتروني</h4>
                  <p className="text-xs text-slate-500 font-bold">للاستفسارات الرسمية والشكاوى والمقترحات</p>
                  <a 
                    href={`mailto:${systemSettings.support?.email || ''}`}
                    className="block w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm shadow-lg text-center"
                  >
                    إرسال إيميل ✉️
                  </a>
                </div>
              </div>

              <div className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 space-y-6">
                <h4 className="font-black text-xl">أرسل لنا رسالة</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="الموضوع" className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border text-xs font-bold outline-none" />
                  <select className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border text-xs font-bold outline-none">
                    <option>استفسار عام</option>
                    <option>مشكلة في الشحن</option>
                    <option>مشكلة في شراء كرت</option>
                    <option>اقتراح تحسين</option>
                  </select>
                  <textarea placeholder="اكتب تفاصيل رسالتك هنا..." rows={4} className="col-span-full w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border text-xs font-bold outline-none resize-none"></textarea>
                  <button className="col-span-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg">إرسال الرسالة ✨</button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div className="max-w-md mx-auto space-y-8">
              <div className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 space-y-6 shadow-xl">
                <div className="w-20 h-20 bg-indigo-600/10 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto text-4xl">🔐</div>
                <div className="text-center">
                  <h4 className="font-black text-xl text-slate-900 dark:text-white">تغيير كلمة المرور</h4>
                  <p className="text-xs text-slate-500 font-bold mt-1">حافظ على أمان حسابك بتحديث كلمة السر دورياً</p>
                </div>
                
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">كلمة المرور الجديدة</label>
                    <input 
                      type="password" 
                      value={passForm.new}
                      onChange={(e) => setPassForm({...passForm, new: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/50" 
                      placeholder="أدخل كلمة المرور الجديدة"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">تأكيد كلمة المرور</label>
                    <input 
                      type="password" 
                      value={passForm.confirm}
                      onChange={(e) => setPassForm({...passForm, confirm: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/50" 
                      placeholder="كرر كلمة المرور مرة أخرى"
                    />
                  </div>
                  <button onClick={handleUpdatePassword} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95 transition-all mt-4">تحديث كلمة السر الآمنة ✨</button>
                </div>
              </div>

              <div className="glass-card p-6 rounded-[2.5rem] border bg-white dark:bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center text-slate-500">📱</div>
                  <div>
                    <p className="text-xs font-black">إصدار التطبيق</p>
                    <p className="text-[10px] text-slate-400 font-bold">v2.4.0 (Stable)</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black">محدث ✅</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {/* Top-up Modal */}
      {showPointsModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-sm p-8 rounded-[3rem] bg-white dark:bg-indigo-950 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b dark:border-white/5 pb-4">
              <h3 className="text-xl font-black text-indigo-600">📥 شحن الرصيد</h3>
              <button onClick={() => setShowPointsModal(false)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المبلغ المطلوب</label>
                <input 
                  type="number" 
                  placeholder="عدد النقاط" 
                  value={topupForm.amount}
                  onChange={e => setTopupForm({...topupForm, amount: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border text-lg font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/50" 
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">وسيلة الدفع</label>
                <select 
                  value={topupForm.method}
                  onChange={e => setTopupForm({...topupForm, method: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border text-xs font-bold outline-none"
                >
                  <option value="">-- اختر البنك / المحفظة --</option>
                  {banks.map(b => <option key={b.id} value={b.bankName}>{b.bankName}</option>)}
                </select>
              </div>

              {topupForm.method && banks.find(b => b.bankName === topupForm.method) && (
                <div className="p-4 bg-indigo-600 text-white rounded-2xl text-center space-y-1 animate-in zoom-in duration-300">
                  <p className="text-[10px] opacity-70 font-bold">حول للمساب التالي:</p>
                  <p className="font-black text-sm">{banks.find(b => b.bankName === topupForm.method)?.accountHolder}</p>
                  <p className="font-mono text-xs tracking-widest">{banks.find(b => b.bankName === topupForm.method)?.accountNumber}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم المرجع (الحوالة)</label>
                <input 
                  type="text" 
                  placeholder="رقم العملية" 
                  value={topupForm.ref}
                  onChange={e => setTopupForm({...topupForm, ref: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border text-xs font-mono outline-none" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المودع</label>
                <input 
                  type="text" 
                  placeholder="الاسم الرباعي" 
                  value={topupForm.client}
                  onChange={e => setTopupForm({...topupForm, client: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border text-xs font-black outline-none" 
                />
              </div>

              <button 
                onClick={() => {
                  if(!topupForm.amount || !topupForm.ref || !topupForm.client) return showNotification('أكمل البيانات', 'error');
                  StorageService.createPointsRequest(user.id, user.fullName, parseInt(topupForm.amount), topupForm.method, topupForm.ref, topupForm.client);
                  showNotification('تم إرسال طلب الشحن بنجاح ✅');
                  setShowPointsModal(false);
                  setTopupForm({ amount: '', method: '', ref: '', client: '' });
                  refreshData();
                }}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all"
              >
                إرسال الطلب للمراجعة 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shopping Categories Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-4xl p-8 rounded-[3rem] bg-white dark:bg-indigo-950 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b dark:border-white/5 pb-4 sticky top-0 bg-white dark:bg-indigo-950 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl">📡</div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">فئات شبكة {selectedAgent.networkName}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">اختر الفئة والكمية المطلوبة</p>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="text-slate-400 hover:text-rose-500"><X size={24} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map(c => {
                const available = stockMap[c.id] || 0;
                const qty = qtyMap[c.id] || 1;
                return (
                  <div key={c.id} className="glass-card p-6 rounded-[2.5rem] border bg-slate-50 dark:bg-white/5 space-y-4 hover:shadow-lg transition-all border-transparent hover:border-indigo-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-base text-slate-900 dark:text-white">{c.name}</h4>
                        <span className="text-[10px] text-indigo-600 font-black bg-indigo-50 px-2 py-0.5 rounded-md mt-1 inline-block">{c.dataSize}</span>
                      </div>
                      <div className={cn(
                        "text-[10px] font-black px-3 py-1 rounded-full",
                        available > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {available > 0 ? `متوفر: ${available}` : 'نفد'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-inner">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setQtyMap({...qtyMap, [c.id]: Math.max(1, qty - 1)})}
                          className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl font-black text-lg hover:bg-indigo-600 hover:text-white transition-all"
                        >-</button>
                        <span className="w-8 text-center font-black text-base">{qty}</span>
                        <button 
                          onClick={() => setQtyMap({...qtyMap, [c.id]: Math.min(available, qty + 1)})}
                          className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl font-black text-lg hover:bg-indigo-600 hover:text-white transition-all"
                        >+</button>
                      </div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">السعر</p>
                        <p className="text-xl font-black text-indigo-600">{c.pointsPrice * qty} <span className="text-[10px]">ن</span></p>
                      </div>
                    </div>

                    <button 
                      disabled={available === 0}
                      onClick={() => setShowConfirm({ cat: c, qty })}
                      className={cn(
                        "w-full py-4 rounded-2xl font-black text-xs shadow-lg transition-all active:scale-95",
                        available > 0 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      {available > 0 ? 'شراء الآن ⚡' : 'غير متوفر'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in duration-200">
          <div className="glass-card w-full max-w-xs p-8 rounded-[3rem] bg-white dark:bg-indigo-950 text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto text-4xl shadow-xl shadow-indigo-200 rotate-12">🛍️</div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">تأكيد الشراء</h3>
              <p className="text-xs text-slate-500 font-bold mt-2 px-4 leading-relaxed">
                هل أنت متأكد من شراء {showConfirm.qty} كرت فئة "{showConfirm.cat.name}"؟ 
                سيتم خصم {showConfirm.qty * showConfirm.cat.pointsPrice} نقطة من رصيدك.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowConfirm(null)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-black text-xs text-slate-500">تراجع</button>
              <button onClick={handleBuy} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all">تأكيد وشراء ✅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
