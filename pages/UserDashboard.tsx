
import React, { useState, useEffect, useMemo } from 'react';
import { User, Category, Order, Agent, BankAccount, CardStatus, Status, TabConfig, DynamicTab, ContentType } from '../types';
import { StorageService } from '../services/storage';
import { useNotification } from '../components/Layout';
import { 
  Search, Download, Eye, EyeOff, Copy, Wallet, 
  History, CreditCard, Bell, LifeBuoy, BarChart3, 
  ArrowUpRight, ArrowDownLeft, Filter, ChevronLeft, ChevronRight,
  Star, Info, CheckCircle2, AlertCircle, Menu, X, LogOut, Settings
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
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [activeSubTabId, setActiveSubTabId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pointsRequests, setPointsRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ cat: Category, qty: number } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [layout, setLayout] = useState<any>(null);
  
  // Forms
  const [form, setForm] = useState({ amount: '', method: '', ref: '', client: '' });
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [passForm, setPassForm] = useState({ new: '', confirm: '' });

  const refreshData = () => {
    const activeAgents = StorageService.getAgents().filter(a => a.isActive);
    setAgents(activeAgents);
    const userOrders = StorageService.getOrders(user.id, user.role);
    setOrders(userOrders);
    setPointsRequests(StorageService.getPointsRequests().filter(r => r.userId === user.id));
    setNotifications(StorageService.getNotifications(user.id));
    setBanks(StorageService.getBankAccounts().filter(b => b.isActive));

    const res = JSON.parse(localStorage.getItem('qw_kroot_v2') || '[]');
    const counts: Record<string, number> = {};
    res.forEach((k: any) => {
       if (k.status === CardStatus.AVAILABLE) counts[k.categoryId] = (counts[k.categoryId] || 0) + 1;
    });
    setStockMap(counts);
  };

  useEffect(() => { refreshData(); }, [user.id, user.pointsBalance]);

  useEffect(() => {
    const settings = StorageService.getSystemSettings();
    const dashboardLayout = settings.dashboardLayout || StorageService.getDefaultDashboardLayout();
    const enabledSections = dashboardLayout.sections.filter(s => s.enabled).sort((a, b) => a.order - b.order);
    
    setLayout({ sections: enabledSections });
    
    if (enabledSections.length > 0) {
      if (!activeSectionId || !enabledSections.some(s => s.id === activeSectionId)) {
        const firstSection = enabledSections[0];
        setActiveSectionId(firstSection.id);
        const firstSubTab = firstSection.subTabs.filter(st => st.enabled).sort((a, b) => a.order - b.order)[0];
        if (firstSubTab) setActiveSubTabId(firstSubTab.id);
      }
    }
  }, [activeSectionId]);

  const activeSection = layout?.sections.find((s: any) => s.id === activeSectionId);
  const activeSubTab = activeSection?.subTabs.find((st: any) => st.id === activeSubTabId) || activeSection?.subTabs[0];

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

  const handleMarkRead = (id: string) => {
    StorageService.markNotificationRead(id);
    refreshData();
  };

  const handleMarkAllRead = () => {
    StorageService.markAllNotificationsRead(user.id);
    refreshData();
  };

  const handleExportCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => `"${val}"`).join(',')
    ).join('\n');
    const csvContent = `\ufeff${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Helper Components ---
  const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) => (
    <div className={cn("glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 flex items-center gap-4", color)}>
      <div className="p-3 rounded-2xl bg-white/20">
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-black">{value}</h3>
      </div>
    </div>
  );

  const DataTable = ({ data, columns, filename, searchPlaceholder }: { data: any[], columns: any[], filename: string, searchPlaceholder?: string }) => {
    const [localSearch, setLocalSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const filtered = useMemo(() => {
      return data.filter(item => 
        Object.values(item).some(val => 
          String(val).toLowerCase().includes(localSearch.toLowerCase())
        )
      );
    }, [data, localSearch]);

    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
    const totalPages = Math.ceil(filtered.length / pageSize);

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder={searchPlaceholder || "بحث..."} 
              value={localSearch}
              onChange={e => { setLocalSearch(e.target.value); setPage(1); }}
              className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl text-xs outline-none focus:border-indigo-500"
            />
          </div>
          <button onClick={() => handleExportCSV(filtered, filename)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-md hover:bg-emerald-700 transition-all">
            <Download size={14} /> تصدير CSV
          </button>
        </div>

        <div className="glass-card rounded-[2rem] overflow-hidden border bg-white dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[10px]">
              <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-500">
                <tr>
                  {columns.map((col, i) => <th key={i} className="p-4">{col.header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                {paginated.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    {columns.map((col, j) => (
                      <td key={j} className="p-4">
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="p-12 text-center text-slate-400 font-bold">لا توجد بيانات متاحة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 pt-2">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 disabled:opacity-20"
            >
              <ChevronRight size={16} />
            </button>
            <span className="text-[10px] font-black">صفحة {page} من {totalPages}</span>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 disabled:opacity-20"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const DynamicTabContent: React.FC<{ tab: DynamicTab }> = ({ tab }) => {
    const userPurchases = orders;
    const userDeposits = pointsRequests;
    
    const totalSpent = userPurchases.reduce((sum, o) => sum + o.pointsUsed, 0);
    const totalDeposited = userDeposits
      .filter(r => r.status === Status.COMPLETED)
      .reduce((sum, r) => sum + r.amount, 0);
    
    const networkStats = userPurchases.reduce((acc: any, o) => {
      if (!acc[o.networkName]) acc[o.networkName] = { count: 0, points: 0 };
      acc[o.networkName].count += 1;
      acc[o.networkName].points += o.pointsUsed;
      return acc;
    }, {});

    const transactions = [
      ...userPurchases.map(p => ({
        id: p.id,
        date: p.createdAt,
        type: 'شراء',
        detail: p.networkName,
        subDetail: p.categoryName,
        amount: p.pointsUsed,
        ref: StorageService.decryptCardCode(p.cardNumber!),
        raw: p
      })),
      ...userDeposits.map(d => ({
        id: d.id,
        date: d.createdAt,
        type: 'شحن',
        detail: d.bankName,
        subDetail: d.status,
        amount: d.amount,
        ref: d.referenceNumber,
        raw: d
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    switch (tab.contentType) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="الرصيد الحالي" value={`${user.pointsBalance} نقطة`} icon={Wallet} color="bg-indigo-600 text-white shadow-indigo-200" />
              <StatCard title="إجمالي الشحن" value={`${totalDeposited} نقطة`} icon={ArrowUpRight} color="bg-emerald-500 text-white shadow-emerald-200" />
              <StatCard title="إجمالي الاستهلاك" value={`${totalSpent} نقطة`} icon={ArrowDownLeft} color="bg-rose-500 text-white shadow-rose-200" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-black text-xs flex items-center gap-2"><History size={14} /> آخر العمليات</h4>
                  <button 
                    onClick={() => {
                      const target = tabsConfig.find(t => t.contentType === 'transactions_list' || t.contentType === 'full_transactions');
                      if (target) setActiveView(target.id);
                    }} 
                    className="text-[10px] font-black text-indigo-600 hover:underline"
                  >
                    عرض الكل
                  </button>
                </div>
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", t.type === 'شراء' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                          {t.type === 'شراء' ? <CreditCard size={14} /> : <ArrowUpRight size={14} />}
                        </div>
                        <div>
                          <p className="font-bold text-xs">{t.type} - {t.detail}</p>
                          <p className="text-[8px] opacity-50">{new Date(t.date).toLocaleString('ar-YE')}</p>
                        </div>
                      </div>
                      <span className={cn("font-black text-xs", t.type === 'شراء' ? "text-rose-600" : "text-emerald-600")}>
                        {t.type === 'شراء' ? '-' : '+'}{t.amount}
                      </span>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="text-center py-8 text-slate-400 font-bold">لا توجد عمليات مؤخراً</p>}
                </div>
              </div>

              <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-black text-xs flex items-center gap-2"><Bell size={14} /> الإشعارات</h4>
                  <button 
                    onClick={() => {
                      const target = tabsConfig.find(t => t.contentType === 'notifications');
                      if (target) setActiveView(target.id);
                    }} 
                    className="text-[10px] font-black text-indigo-600 hover:underline"
                  >
                    عرض الكل
                  </button>
                </div>
                <div className="space-y-3">
                  {notifications.slice(0, 5).map((n, i) => (
                    <div key={i} className={cn("p-3 rounded-xl border transition-all", n.read ? "bg-slate-50 dark:bg-slate-900 border-transparent opacity-60" : "bg-indigo-50/30 border-indigo-100 dark:border-indigo-900/30")}>
                      <div className="flex justify-between items-start">
                        <h5 className="font-black text-[10px]">{n.title}</h5>
                        <span className="text-[7px] opacity-50">{new Date(n.createdAt).toLocaleDateString('ar-YE')}</span>
                      </div>
                      <p className="text-[9px] font-bold mt-1 line-clamp-1">{n.message}</p>
                    </div>
                  ))}
                  {notifications.length === 0 && <p className="text-center py-8 text-slate-400 font-bold">لا توجد إشعارات جديدة</p>}
                </div>
              </div>
            </div>
          </div>
        );

      case 'user_wallet':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="الرصيد الحالي" value={`${user.pointsBalance} نقطة`} icon={Wallet} color="bg-indigo-600 text-white" />
              <StatCard title="إجمالي الشحن" value={`${totalDeposited} نقطة`} icon={ArrowUpRight} color="bg-emerald-500 text-white" />
              <StatCard title="إجمالي الاستهلاك" value={`${totalSpent} نقطة`} icon={ArrowDownLeft} color="bg-rose-500 text-white" />
            </div>
            
            <div className="flex justify-center">
              <button onClick={() => setShowPointsModal(true)} className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-xl hover:scale-105 transition-all flex items-center gap-2">
                <ArrowUpRight size={20} /> شحن رصيد جديد
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="font-black text-xs flex items-center gap-2"><History size={14} /> سجل عمليات الشحن</h4>
              <DataTable 
                data={userDeposits} 
                filename="deposits"
                searchPlaceholder="بحث في الشحنات..."
                columns={[
                  { header: 'التاريخ', render: (row: any) => <span className="font-mono text-[8px]">{new Date(row.createdAt).toLocaleString('ar-YE')}</span> },
                  { header: 'البنك', key: 'bankName' },
                  { header: 'المبلغ', render: (row: any) => <span className="font-black text-emerald-600">{row.amount}</span> },
                  { header: 'الحالة', render: (row: any) => (
                    <span className={cn("px-2 py-0.5 rounded-md", 
                      row.status === Status.COMPLETED ? 'bg-emerald-50 text-emerald-600' : 
                      row.status === Status.REJECTED ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                    )}>{row.status}</span>
                  )},
                  { header: 'المرجع', render: (row: any) => <span className="font-mono text-[8px]">{row.referenceNumber}</span> }
                ]}
              />
            </div>
          </div>
        );

      case 'transactions_list':
        return (
          <div className="space-y-4">
            <h4 className="font-black text-xs flex items-center gap-2"><History size={14} /> سجل العمليات الموحد</h4>
            <DataTable 
              data={transactions}
              filename="all_transactions"
              searchPlaceholder="بحث في جميع العمليات..."
              columns={[
                { header: 'التاريخ', render: (row: any) => <span className="font-mono text-[8px]">{new Date(row.date).toLocaleString('ar-YE')}</span> },
                { header: 'النوع', render: (row: any) => (
                  <span className={cn("px-2 py-0.5 rounded-md", row.type === 'شراء' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>{row.type}</span>
                )},
                { header: 'البيان', render: (row: any) => (
                  <div>
                    <p className="font-bold">{row.detail}</p>
                    <p className="text-[8px] opacity-50">{row.subDetail}</p>
                  </div>
                )},
                { header: 'المبلغ', render: (row: any) => <span className={cn("font-black", row.type === 'شراء' ? 'text-rose-600' : 'text-emerald-600')}>{row.amount}</span> },
                { header: 'المرجع', render: (row: any) => (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[8px]">{revealed[row.id] ? row.ref : '••••••••••••'}</span>
                    {row.type === 'شراء' && (
                      <button onClick={() => setRevealed({...revealed, [row.id]: !revealed[row.id]})} className="text-slate-400 hover:text-indigo-600 transition-colors">
                        {revealed[row.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </div>
                )}
              ]}
            />
          </div>
        );

      case 'purchased_cards':
        return (
          <div className="space-y-4">
            <h4 className="font-black text-xs flex items-center gap-2"><CreditCard size={14} /> الكروت المشتراة</h4>
            <DataTable 
              data={userPurchases}
              filename="my_cards"
              searchPlaceholder="بحث في الكروت..."
              columns={[
                { header: 'التاريخ', render: (row: any) => <span className="font-mono text-[8px]">{new Date(row.createdAt).toLocaleString('ar-YE')}</span> },
                { header: 'الشبكة', key: 'networkName' },
                { header: 'الفئة', key: 'categoryName' },
                { header: 'النقاط', key: 'pointsUsed' },
                { header: 'الكود', render: (row: any) => (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[8px]">{revealed[row.id] ? StorageService.decryptCardCode(row.cardNumber!) : '••••••••••••'}</span>
                    <button onClick={() => setRevealed({...revealed, [row.id]: !revealed[row.id]})} className="text-slate-400 hover:text-indigo-600 transition-colors">
                      {revealed[row.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    {revealed[row.id] && (
                      <button onClick={() => { navigator.clipboard.writeText(StorageService.decryptCardCode(row.cardNumber!)); showNotification('تم النسخ ✅'); }} className="text-indigo-600">
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                )}
              ]}
            />
          </div>
        );

      case 'favorite_networks':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(networkStats).map(([name, stats]: [string, any]) => (
              <div key={name} className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-4 hover:shadow-lg transition-all">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center text-xl">📡</div>
                    <h4 className="font-black text-sm">{name}</h4>
                  </div>
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-indigo-50 dark:bg-white/5 rounded-xl text-center">
                    <p className="text-[8px] font-black opacity-50 uppercase">الكروت</p>
                    <p className="font-black text-indigo-600">{stats.count}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-white/5 rounded-xl text-center">
                    <p className="text-[8px] font-black opacity-50 uppercase">النقاط</p>
                    <p className="font-black text-emerald-600">{stats.points}</p>
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(networkStats).length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 font-bold border-2 border-dashed rounded-[2rem]">
                لم تقم بالشراء من أي شبكة بعد
              </div>
            )}
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-black text-xs flex items-center gap-2"><Bell size={14} /> الإشعارات</h4>
              <button onClick={handleMarkAllRead} className="text-[10px] font-black text-indigo-600 hover:underline">تحديد الكل كمقروء</button>
            </div>
            <div className="space-y-3">
              {notifications.map((n, i) => (
                <div key={i} className={cn("glass-card p-5 rounded-[2rem] border transition-all flex gap-4", n.read ? "bg-slate-50 dark:bg-slate-900 border-transparent opacity-60" : "bg-white dark:bg-white/5 border-indigo-100 dark:border-indigo-900/30 shadow-sm")}>
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", 
                    n.type === 'success' ? "bg-emerald-50 text-emerald-600" : 
                    n.type === 'warning' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                  )}>
                    {n.type === 'success' ? <CheckCircle2 size={20} /> : n.type === 'warning' ? <AlertCircle size={20} /> : <Info size={20} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h5 className="font-black text-sm">{n.title}</h5>
                      <span className="text-[8px] opacity-50 font-mono">{new Date(n.createdAt).toLocaleString('ar-YE')}</span>
                    </div>
                    <p className="text-xs font-bold mt-1 text-slate-600 dark:text-slate-400">{n.message}</p>
                    {!n.read && (
                      <button onClick={() => handleMarkRead(n.id)} className="text-[10px] font-black text-indigo-600 mt-2">تحديد كمقروء</button>
                    )}
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="py-20 text-center text-slate-400 font-bold border-2 border-dashed rounded-[3rem]">
                  لا توجد إشعارات حالياً
                </div>
              )}
            </div>
          </div>
        );

      case 'support':
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto text-3xl shadow-xl shadow-indigo-200">
                <LifeBuoy size={40} />
              </div>
              <h3 className="text-xl font-black">الدعم الفني</h3>
              <p className="text-xs text-slate-500 font-bold">نحن هنا لمساعدتك في أي وقت</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a href="https://wa.me/967770000000" target="_blank" className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 flex items-center gap-4 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.554 4.189 1.605 6.006L0 24l6.117-1.605a11.803 11.803 0 005.925 1.586h.005c6.631 0 12.026-5.396 12.029-12.03.002-3.218-1.252-6.244-3.528-8.52z"/></svg>
                </div>
                <div>
                  <p className="font-black text-sm">واتساب</p>
                  <p className="text-[10px] font-bold text-slate-500">تواصل معنا عبر الواتساب</p>
                </div>
              </a>
              <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Bell size={24} />
                </div>
                <div>
                  <p className="font-black text-sm">مركز المساعدة</p>
                  <p className="text-[10px] font-bold text-slate-500">دليل المستخدم والأسئلة الشائعة</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-8 rounded-[3rem] border bg-white dark:bg-white/5 space-y-4">
              <h4 className="font-black text-sm">أرسل لنا رسالة</h4>
              <div className="space-y-3">
                <input type="text" placeholder="الموضوع" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl outline-none focus:border-indigo-500 text-xs font-bold" />
                <textarea placeholder="كيف يمكننا مساعدتك؟" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl outline-none focus:border-indigo-500 text-xs font-bold h-32" />
                <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all">إرسال الرسالة</button>
              </div>
            </div>
          </div>
        );

      case 'reports': {
        const chartData = useMemo(() => {
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
          }).reverse();

          return last7Days.map(date => {
            const dayPurchases = userPurchases.filter(p => p.createdAt.startsWith(date));
            const dayDeposits = userDeposits.filter(d => d.createdAt.startsWith(date) && d.status === Status.COMPLETED);
            return {
              name: new Date(date).toLocaleDateString('ar-YE', { weekday: 'short' }),
              purchases: dayPurchases.reduce((sum, p) => sum + p.pointsUsed, 0),
              deposits: dayDeposits.reduce((sum, d) => sum + d.amount, 0)
            };
          });
        }, [userPurchases, userDeposits]);

        const pieData = Object.entries(networkStats).map(([name, stats]: [string, any]) => ({
          name,
          value: stats.points
        }));

        const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-4">
                <h4 className="font-black text-xs flex items-center gap-2"><BarChart3 size={14} /> نشاط الأسبوع الأخير</h4>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="purchases" name="استهلاك" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="deposits" name="شحن" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-4">
                <h4 className="font-black text-xs flex items-center gap-2"><BarChart3 size={14} /> توزيع الاستهلاك حسب الشبكة</h4>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  {pieData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-[8px] font-black">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-4">
              <h4 className="font-black text-xs">إحصائيات متقدمة</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center">
                  <p className="text-[8px] font-black opacity-50 uppercase">متوسط الشحن</p>
                  <p className="text-lg font-black text-emerald-600">{userDeposits.length > 0 ? Math.round(totalDeposited / userDeposits.length) : 0}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center">
                  <p className="text-[8px] font-black opacity-50 uppercase">متوسط الشراء</p>
                  <p className="text-lg font-black text-rose-600">{userPurchases.length > 0 ? Math.round(totalSpent / userPurchases.length) : 0}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center">
                  <p className="text-[8px] font-black opacity-50 uppercase">أكثر شبكة</p>
                  <p className="text-[10px] font-black truncate">{Object.entries(networkStats).sort((a: any, b: any) => b[1].count - a[1].count)[0]?.[0] || '---'}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center">
                  <p className="text-[8px] font-black opacity-50 uppercase">أيام النشاط</p>
                  <p className="text-lg font-black text-indigo-600">{new Set([...userPurchases, ...userDeposits].map(x => x.createdAt.split('T')[0])).size}</p>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'user_summary':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-6 rounded-[2rem] border bg-indigo-600 text-white">
                <p className="text-[8px] font-black opacity-70 uppercase tracking-widest">الرصيد الحالي</p>
                <h3 className="text-3xl font-black mt-1">{user.pointsBalance}</h3>
              </div>
              <div className="glass-card p-6 rounded-[2rem] border bg-emerald-500 text-white">
                <p className="text-[8px] font-black opacity-70 uppercase tracking-widest">إجمالي الشحن</p>
                <h3 className="text-3xl font-black mt-1">{totalDeposited}</h3>
              </div>
              <div className="glass-card p-6 rounded-[2rem] border bg-rose-500 text-white">
                <p className="text-[8px] font-black opacity-70 uppercase tracking-widest">إجمالي الاستهلاك</p>
                <h3 className="text-3xl font-black mt-1">{totalSpent}</h3>
              </div>
              <div className="glass-card p-6 rounded-[2rem] border bg-amber-500 text-white">
                <p className="text-[8px] font-black opacity-70 uppercase tracking-widest">عدد الكروت</p>
                <h3 className="text-3xl font-black mt-1">{userPurchases.length}</h3>
              </div>
            </div>
            <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5">
              <h4 className="font-black text-xs mb-4">إحصائيات الشبكات</h4>
              <div className="space-y-3">
                {Object.entries(networkStats).map(([name, stats]: [string, any]) => (
                  <div key={name} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="font-bold text-xs">{name}</span>
                    <div className="flex gap-4">
                      <span className="text-[10px] font-black text-indigo-600">{stats.count} كرت</span>
                      <span className="text-[10px] font-black text-emerald-600">{stats.points} نقطة</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'full_transactions': {
        const transactions = [
          ...userPurchases.map(p => ({
            date: p.createdAt,
            type: 'شراء',
            detail: p.networkName,
            subDetail: p.categoryName,
            amount: p.pointsUsed,
            ref: StorageService.decryptCardCode(p.cardNumber!)
          })),
          ...userDeposits.map(d => ({
            date: d.createdAt,
            type: 'شحن',
            detail: d.bankName,
            subDetail: d.status,
            amount: d.amount,
            ref: d.referenceNumber
          }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => handleExportCSV(transactions, 'transactions')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-md">تصدير CSV 📥</button>
            </div>
            <div className="glass-card rounded-[2rem] overflow-hidden border bg-white dark:bg-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[10px]">
                  <thead className="bg-slate-50 dark:bg-white/5 font-black">
                    <tr>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">النوع</th>
                      <th className="p-4">البيان</th>
                      <th className="p-4">المبلغ</th>
                      <th className="p-4">المرجع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                    {transactions.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="p-4 font-mono text-[8px]">{new Date(t.date).toLocaleString('ar-YE')}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-md ${t.type === 'شراء' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{t.type}</span>
                        </td>
                        <td className="p-4">
                          <div>{t.detail}</div>
                          <div className="text-[8px] opacity-50">{t.subDetail}</div>
                        </td>
                        <td className="p-4 font-black">{t.amount}</td>
                        <td className="p-4 font-mono text-[8px]">
                          <div className="flex items-center gap-2">
                            <span>{revealed[t.ref] ? t.ref : '••••••••••••'}</span>
                            {t.type === 'شراء' && (
                              <button onClick={() => setRevealed({...revealed, [t.ref]: !revealed[t.ref]})} className="text-[10px]">
                                {revealed[t.ref] ? '🙈' : '👁️'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      case 'purchases_only': {
        const purchases = userPurchases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => handleExportCSV(purchases, 'purchases')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-md">تصدير CSV 📥</button>
            </div>
            <div className="glass-card rounded-[2rem] overflow-hidden border bg-white dark:bg-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[10px]">
                  <thead className="bg-slate-50 dark:bg-white/5 font-black">
                    <tr>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">الشبكة</th>
                      <th className="p-4">الفئة</th>
                      <th className="p-4">النقاط</th>
                      <th className="p-4">الكود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                    {purchases.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="p-4 font-mono text-[8px]">{new Date(p.createdAt).toLocaleString('ar-YE')}</td>
                        <td className="p-4">{p.networkName}</td>
                        <td className="p-4">{p.categoryName}</td>
                        <td className="p-4 font-black">{p.pointsUsed}</td>
                        <td className="p-4 font-mono text-[8px]">
                          <div className="flex items-center gap-2">
                            <span>{revealed[p.id] ? StorageService.decryptCardCode(p.cardNumber!) : '••••••••••••'}</span>
                            <button onClick={() => setRevealed({...revealed, [p.id]: !revealed[p.id]})} className="text-[10px]">
                              {revealed[p.id] ? '🙈' : '👁️'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      case 'deposits_only': {
        const deposits = userDeposits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => handleExportCSV(deposits, 'deposits')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-md">تصدير CSV 📥</button>
            </div>
            <div className="glass-card rounded-[2rem] overflow-hidden border bg-white dark:bg-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[10px]">
                  <thead className="bg-slate-50 dark:bg-white/5 font-black">
                    <tr>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">البنك</th>
                      <th className="p-4">المبلغ</th>
                      <th className="p-4">الحالة</th>
                      <th className="p-4">المرجع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                    {deposits.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="p-4 font-mono text-[8px]">{new Date(d.createdAt).toLocaleString('ar-YE')}</td>
                        <td className="p-4">{d.bankName}</td>
                        <td className="p-4 font-black">{d.amount}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-md ${d.status === Status.COMPLETED ? 'bg-emerald-50 text-emerald-600' : d.status === Status.REJECTED ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{d.status}</span>
                        </td>
                        <td className="p-4 font-mono text-[8px]">{d.referenceNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      case 'networks_summary':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(networkStats).map(([name, stats]: [string, any]) => (
              <div key={name} className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-sm">{name}</h4>
                  <span className="text-2xl">📡</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-indigo-50 dark:bg-white/5 rounded-xl text-center">
                    <p className="text-[8px] font-black opacity-50">الكروت</p>
                    <p className="font-black text-indigo-600">{stats.count}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-white/5 rounded-xl text-center">
                    <p className="text-[8px] font-black opacity-50">النقاط</p>
                    <p className="font-black text-emerald-600">{stats.points}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'recent_activities': {
        const activities = [
          ...userPurchases.map(p => ({ date: p.createdAt, title: `شراء كرت ${p.networkName}`, amount: -p.pointsUsed, icon: '🎫' })),
          ...userDeposits.map(d => ({ date: d.createdAt, title: `شحن رصيد (${d.bankName})`, amount: d.amount, icon: '💰', status: d.status }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

        return (
          <div className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-4">
            <h4 className="font-black text-xs border-b pb-2">آخر النشاطات</h4>
            <div className="space-y-3">
              {activities.map((a, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{a.icon}</span>
                    <div>
                      <p className="font-bold text-xs">{a.title}</p>
                      <p className="text-[8px] opacity-50 font-mono">{new Date(a.date).toLocaleString('ar-YE')}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={`font-black text-xs ${a.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{a.amount > 0 ? '+' : ''}{a.amount}</p>
                    {a.status && <p className="text-[7px] font-bold opacity-50">{a.status}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'text':
        return <div className="glass-card p-8 rounded-[2rem] border bg-white dark:bg-white/5"><p className="text-sm font-bold leading-relaxed">{tab.content}</p></div>;
      case 'html':
        return <div className="glass-card p-8 rounded-[2rem] border bg-white dark:bg-white/5" dangerouslySetInnerHTML={{ __html: tab.content }} />;
      case 'table':
        return (
          <div className="glass-card rounded-[2rem] overflow-hidden border bg-white dark:bg-white/5">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-white/5 font-black">
                <tr>
                  {tab.content.columns?.map((col: string, i: number) => <th key={i} className="p-4">{col}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                {tab.content.rows?.map((row: any[], i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    {row.map((cell: any, j: number) => <td key={j} className="p-4">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'cards':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tab.content.map((item: any, i: number) => (
              <div key={i} className="glass-card p-6 rounded-[2rem] border bg-white dark:bg-white/5 space-y-3">
                {item.image && <img src={item.image} alt={item.title} className="w-full h-32 object-cover rounded-xl" />}
                <h4 className="font-black text-sm">{item.title}</h4>
                <p className="text-[10px] text-slate-500 font-bold">{item.description}</p>
              </div>
            ))}
          </div>
        );
      case 'stats':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tab.content.showPoints && (
              <div className="glass-card p-6 rounded-[2rem] border bg-indigo-50 dark:bg-white/5">
                <p className="text-[8px] font-black opacity-50 uppercase tracking-widest">رصيدك</p>
                <h3 className="text-2xl font-black text-indigo-600 mt-1">{user.pointsBalance}</h3>
              </div>
            )}
            {tab.content.showOrders && (
              <div className="glass-card p-6 rounded-[2rem] border bg-emerald-50 dark:bg-white/5">
                <p className="text-[8px] font-black opacity-50 uppercase tracking-widest">مشترياتك</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{orders.length}</h3>
              </div>
            )}
            {tab.content.customStats?.map((stat: any, i: number) => (
              <div key={i} className="glass-card p-6 rounded-[2rem] border bg-slate-50 dark:bg-white/5">
                <p className="text-[8px] font-black opacity-50 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200 mt-1">{stat.value}</h3>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-120px)] gap-6" dir="rtl">
      {/* Sidebar */}
      <aside className={cn(
        "lg:w-64 shrink-0 glass-card rounded-[2.5rem] border bg-white dark:bg-white/5 p-4 flex flex-col gap-2 transition-all duration-300",
        "fixed inset-y-0 right-0 z-[100] lg:relative lg:inset-auto",
        isSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between mb-6 px-2 lg:hidden">
          <h2 className="font-black text-indigo-600">القائمة</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
          {layout?.sections.map((section: any) => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSectionId(section.id);
                const firstSub = section.subTabs.filter((st: any) => st.enabled).sort((a: any, b: any) => a.order - b.order)[0];
                if (firstSub) setActiveSubTabId(firstSub.id);
                setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-xs transition-all",
                activeSectionId === section.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
              )}
            >
              <span className="text-lg">{section.icon}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </div>

        <div className="pt-4 border-t dark:border-white/5 space-y-1">
          <button onClick={onUpdate} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5">
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 space-y-6">
        {/* Mobile Header */}
        <div className="lg:hidden flex justify-between items-center mb-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white dark:bg-white/5 rounded-2xl shadow-sm border"><Menu size={20} /></button>
          <h1 className="font-black text-indigo-600">{activeSection?.label}</h1>
          <div className="w-10"></div>
        </div>

        {/* Sub-tabs Header */}
        {activeSection && activeSection.subTabs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {activeSection.subTabs.filter((st: any) => st.enabled).sort((a: any, b: any) => a.order - b.order).map((st: any) => (
              <button
                key={st.id}
                onClick={() => setActiveSubTabId(st.id)}
                className={cn(
                  "px-6 py-2.5 rounded-2xl font-black text-[10px] transition-all whitespace-nowrap border",
                  activeSubTabId === st.id 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md" 
                    : "bg-white dark:bg-white/5 text-slate-500 border-slate-100 dark:border-white/10 hover:border-indigo-200"
                )}
              >
                {st.icon} {st.label}
              </button>
            ))}
          </div>
        )}

        {/* Dynamic Content Rendering */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeSubTab && (
            <div className="space-y-6">
              {/* Action Buttons Header */}
              {activeSubTab.buttons && activeSubTab.buttons.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {activeSubTab.buttons.map((btn: any) => (
                    <button
                      key={btn.id}
                      onClick={() => {
                        if (btn.actionType === 'openModal' && btn.actionData?.modal === 'points') setShowPointsModal(true);
                        if (btn.actionType === 'navigate' && btn.actionData?.tab) {
                          const target = layout.sections.find((s: any) => s.subTabs.some((st: any) => st.id === btn.actionData.tab));
                          if (target) {
                            setActiveSectionId(target.id);
                            setActiveSubTabId(btn.actionData.tab);
                          }
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition-all border border-indigo-100"
                    >
                      {btn.icon && <span>{btn.icon}</span>}
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}

              {activeSubTab.contentType === 'builtin' ? (
                activeSubTab.content?.type === 'shopping' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                      <div className="glass-card p-6 rounded-[2.5rem] bg-indigo-600 text-white shadow-xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-3 opacity-10 text-5xl">💎</div>
                         <p className="text-[8px] font-black opacity-70 mb-1 uppercase tracking-widest">رصيدك الحالي</p>
                         <div className="text-3xl font-black mb-4">{user.pointsBalance} <span className="text-[8px] uppercase opacity-80 font-bold">نقطة</span></div>
                         <button onClick={() => setShowPointsModal(true)} className="w-full py-3 bg-white text-indigo-600 rounded-xl font-black text-[10px] shadow-lg active:scale-95 transition-all">شحن رصيد +</button>
                      </div>
                      <div className="glass-card p-4 rounded-[2.5rem] border bg-white dark:bg-white/5 space-y-3">
                         <h3 className="font-black text-[9px] text-slate-400 px-1 tracking-widest uppercase">الشبكات المتوفرة</h3>
                         <div className="space-y-1.5 max-h-[400px] overflow-y-auto no-scrollbar">
                            {filteredAgents.map(a => (
                              <button key={a.id} onClick={() => { setSelectedAgent(a); setCategories(StorageService.getCategories(a.id).filter(c => c.isActive)); }} className={cn("w-full p-3 rounded-xl text-right border transition-all flex justify-between items-center", selectedAgent?.id === a.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100')}><span className="font-black text-[10px]">{a.networkName}</span><span className="text-[8px] opacity-40">◀</span></button>
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
                                      <div className={cn("text-[8px] font-black px-2 py-0.5 rounded-md", available > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>{available > 0 ? `متوفر: ${available}` : 'نفد'}</div>
                                   </div>
                                   <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                      <div className="flex items-center gap-2">
                                         <button onClick={() => handleQtyChange(c.id, (qty - 1).toString(), available)} className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg font-black shadow-sm text-xs">-</button>
                                         <input type="number" value={qty} onChange={(e) => handleQtyChange(c.id, e.target.value, available)} className="w-10 bg-transparent text-center font-black text-xs outline-none border-none" />
                                         <button onClick={() => handleQtyChange(c.id, (qty + 1).toString(), available)} className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg font-black shadow-sm text-xs">+</button>
                                      </div>
                                      <div className="text-left font-black text-lg">{(c.pointsPrice * qty)} <span className="text-[8px]">نقطة</span></div>
                                   </div>
                                   <button disabled={available === 0 || qty === 0} onClick={() => setShowConfirm({ cat: c, qty })} className={cn("w-full py-3 rounded-xl font-black text-[10px] shadow-md transition-all", available > 0 && qty > 0 ? 'bg-indigo-600 text-white active:scale-95' : 'bg-slate-100 text-slate-400')}>{available > 0 ? 'شراء الآن ⚡' : 'نفد المخزون'}</button>
                                </div>
                              );
                           })}
                        </div>
                      ) : (
                        <div className="glass-card py-20 rounded-[3rem] text-center border-dashed border-2 text-slate-300 dark:border-white/5">
                          <div className="text-6xl mb-4 opacity-20">🛒</div>
                          <h3 className="text-base font-black">يرجى اختيار شبكة للبدء بالتسوق</h3>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md mx-auto glass-card p-8 rounded-[3rem] border space-y-6 text-center shadow-2xl mt-10">
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
                )
              ) : (
                <DynamicTabContent tab={activeSubTab} />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
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
