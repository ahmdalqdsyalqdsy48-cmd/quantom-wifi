
import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { User, UserRole, Status, PointRequest, SettlementReport, BankAccount, Card, CardStatus, Order, Agent, MikroTikConfig, SystemSettings, AgentVisibleTabs, TabConfig, DynamicTab, ContentType, UserDashboardLayout } from '../types';
import { StorageService, SystemLog } from '../services/storage';
import { useNotification } from '../components/Layout';
// @ts-ignore
import html2pdf from 'html2pdf.js';

// --- Components ---

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
    <button
        onClick={onChange}
        className={`w-10 h-5 rounded-full relative transition-colors duration-300 focus:outline-none ${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${checked ? 'right-5' : 'right-0.5'}`} />
    </button>
);

interface StatCardProps {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    onReset: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, onReset }) => {
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-50 border-indigo-500 text-indigo-700',
        emerald: 'bg-emerald-50 border-emerald-500 text-emerald-700',
        amber: 'bg-amber-50 border-amber-500 text-amber-700',
        rose: 'bg-rose-50 border-rose-500 text-rose-700',
        cyan: 'bg-cyan-50 border-cyan-500 text-cyan-700',
        violet: 'bg-violet-50 border-violet-500 text-violet-700',
        slate: 'bg-slate-50 border-slate-500 text-slate-700',
        orange: 'bg-orange-50 border-orange-500 text-orange-700',
        sky: 'bg-sky-50 border-sky-500 text-sky-700',
        lime: 'bg-lime-50 border-lime-500 text-lime-700',
        fuchsia: 'bg-fuchsia-50 border-fuchsia-500 text-fuchsia-700',
        pink: 'bg-pink-50 border-pink-500 text-pink-700',
        teal: 'bg-teal-50 border-teal-500 text-teal-700',
        blue: 'bg-blue-50 border-blue-500 text-blue-700',
        gray: 'bg-gray-50 border-gray-500 text-gray-700',
    };
    const activeClass = colorClasses[color] || colorClasses.indigo;

    return (
        <div className={`glass-card p-3 rounded-xl border-b-4 flex flex-col justify-between h-full relative group transition-all duration-300 ${activeClass}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className="text-xl opacity-80">{icon}</div>
                    <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{title}</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onReset(); }}
                    className="opacity-40 hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center bg-white/60 hover:bg-white rounded-full text-rose-500 shadow-sm"
                    title="تصفير الإحصائية"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
            </div>
            <div className="mt-2 text-right">
                <span className="text-2xl font-black">{value}</span>
            </div>
        </div>
    );
};

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
    <div className="flex flex-wrap justify-between items-end mb-6 gap-4 animate-in slide-in-from-bottom-2">
        <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 font-bold mt-1">{subtitle}</p>}
        </div>
        {action}
    </div>
);

const SimpleBarChart: React.FC<{ data: number[], labels: string[], color: string }> = ({ data, labels, color }) => {
    const max = Math.max(...data, 1);
    return (
        <div className="flex items-end justify-between h-24 gap-1 mt-4">
            {data.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center justify-end w-full group relative">
                    <div 
                        className={`w-full rounded-t-sm transition-all duration-500 ${color}`}
                        style={{ height: `${(val / max) * 100}%`, minHeight: '4px' }}
                    ></div>
                    <span className="text-[8px] mt-1 opacity-50 truncate w-full text-center">{labels[idx]}</span>
                    <div className="absolute bottom-full mb-1 bg-black text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {val}
                    </div>
                </div>
            ))}
        </div>
    );
};

const DetailBox: React.FC<{ label: string; value: string | number; icon: string; color: string; fullWidth?: boolean }> = ({ label, value, icon, color, fullWidth }) => (
    <div className={`p-4 rounded-2xl border ${color} ${fullWidth ? 'col-span-full' : ''} flex flex-col gap-1 shadow-sm hover:shadow-md transition-all`}>
        <div className="flex items-center gap-2 opacity-70">
            <span className="text-sm">{icon}</span>
            <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-sm font-black truncate">{value}</div>
    </div>
);

const AdminDashboard: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { showNotification } = useNotification();
  const [_, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- UI State ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<'home' | 'requests' | 'agents' | 'managers' | 'finance' | 'banks' | 'reports' | 'monitoring' | 'activity_log' | 'settings'>('home');
  const [reportTab, setReportTab] = useState<'sales' | 'shipping' | 'users' | 'agents_perf'>('sales');

  // --- Data State ---
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pointRequests, setPointRequests] = useState<PointRequest[]>([]);
  const [settlements, setSettlements] = useState<SettlementReport[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ 
    maintenance: false, 
    announcement: '',
    agentTabs: StorageService.getDefaultAgentTabs(),
    userTabs: StorageService.getDefaultUserTabs(),
    agentVisibleTabs: {
      stats: true,
      categories: true,
      archive: true,
      sales: true,
      settlements: true,
      settings: true,
    }
  });
  
  // Admin Profile
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);
  const [adminTheme, setAdminTheme] = useState<string>('default');

  // Stats Logic (Offsets for Resets)
  const [statOffsets, setStatOffsets] = useState<Record<string, number>>({});
  
  // Log Filters & Search
  const [logFilter, setLogFilter] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [logSearch, setLogSearch] = useState('');

  // Requests Filter
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAW'>('ALL');

  // Report Filters
  const [reportTimeFilter, setReportTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('DAY');
  const [customReportDate, setCustomReportDate] = useState({ start: '', end: '' });

  // MikroTik Config State
  const [mikroTikConfig, setMikroTikConfig] = useState<MikroTikConfig>({ host: '', port: '8728', username: '', password: '', mode: 'MANUAL' });
  const [userLayout, setUserLayout] = useState<UserDashboardLayout>(StorageService.getDefaultUserLayout());

  // --- Modals State ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ id: '', fullName: '', email: '', phone: '', password: '', role: UserRole.AGENT, networkName: '', profitPercentage: 0, isActive: true });
  const [isEditMode, setIsEditMode] = useState(false);
  
  // System Bank Modal State
  const [showSystemBankModal, setShowSystemBankModal] = useState(false);
  const [systemBankForm, setSystemBankForm] = useState<BankAccount>({ id: '', bankName: '', accountNumber: '', accountHolder: '', isActive: true });

  const [confirmModal, setConfirmModal] = useState<{ 
      isOpen: boolean; 
      title: string; 
      message: string; 
      action: () => void; 
      type: 'danger' | 'info' | 'success';
      requirePin?: boolean;
      requireReason?: boolean; // For Rejection
      requireAmount?: boolean; // For Edit
      currentAmount?: number;
  }>({ isOpen: false, title: '', message: '', action: () => {}, type: 'info' });
  
  const [pinInput, setPinInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [amountInput, setAmountInput] = useState('');

  const [viewModal, setViewModal] = useState<{ isOpen: boolean; title: string; data: any; type: string } | null>(null);
  const [showTabEditor, setShowTabEditor] = useState<{ isOpen: boolean; tab?: DynamicTab } | null>(null);
  const [tabForm, setTabForm] = useState<Partial<DynamicTab>>({
    label: '',
    icon: '',
    contentType: 'text',
    content: '',
    enabled: true
  });

  // --- Initialization ---
  const refreshData = () => {
    setUsers(StorageService.getUsers());
    setOrders(StorageService.getOrders(undefined, UserRole.ADMIN));
    setPointRequests(StorageService.getPointsRequests());
    setSettlements(StorageService.getSettlementReports());
    setBanks(StorageService.getBankAccounts());
    setAllCards(StorageService.getAllCards());
    setCategories(StorageService.getCategories());
    setSystemLogs(StorageService.getSystemLogs());
    
    setAdminAvatar(StorageService.getAdminAvatar());
    setAdminTheme(StorageService.getAdminTheme());
    setStatOffsets(StorageService.getStatOffsets());
    
    setSystemSettings(StorageService.getSystemSettings());
    setUserLayout(StorageService.getUserLayout());

    const savedMikroTik = localStorage.getItem('qw_mikrotik_config');
    if(savedMikroTik) setMikroTikConfig(JSON.parse(savedMikroTik));
  };

  useEffect(() => {
    refreshData();
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  const handleNavigate = (section: typeof activeSection) => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      startTransition(() => { setActiveSection(section); });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          StorageService.updateAdminAvatar(base64);
          setAdminAvatar(base64);
          showNotification('تم تحديث الصورة الشخصية ✅', 'success');
        };
        reader.readAsDataURL(file);
      }
  };

  const handleDeleteUser = (user: User) => {
      setConfirmModal({
        isOpen: true,
        title: user.role === UserRole.AGENT ? 'أرشفة الوكيل' : 'حذف المستخدم',
        message: user.role === UserRole.AGENT 
          ? `هل أنت متأكد من أرشفة الوكيل "${user.fullName}"؟ سيتم إخفاؤه من القائمة ولكن ستبقى بياناته المالية محفوظة.`
          : 'هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذه العملية.',
        type: 'danger',
        requirePin: true,
        action: () => {
            StorageService.deleteUser(user.id);
            StorageService.logAction('حذف/أرشفة مستخدم', `تم أرشفة/حذف المستخدم: ${user.fullName} (${user.role})`, currentUser.fullName, 'DELETE');
            refreshData();
            showNotification(user.role === UserRole.AGENT ? 'تم أرشفة الوكيل بنجاح 📦' : 'تم حذف المستخدم بنجاح 🗑️', 'info');
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
  };

  const handleToggleAgent = (agent: User) => {
      const newStatus = !agent.isActive;
      StorageService.updateUser(agent.id, { isActive: newStatus });
      StorageService.logAction(
          newStatus ? 'تنشيط وكيل' : 'تعطيل وكيل',
          `تم ${newStatus ? 'تنشيط' : 'تعطيل'} حساب الوكيل ${agent.fullName}`,
          currentUser.fullName,
          'EDIT'
      );
      refreshData();
      showNotification(newStatus ? 'تم تنشيط الوكيل ✅' : 'تم تعطيل الوكيل ⛔', newStatus ? 'success' : 'info');
  };

  const handleSaveSettings = () => {
      StorageService.saveSystemSettings(systemSettings);
      StorageService.updateAdminTheme(adminTheme);
      showNotification('تم حفظ الإعدادات ✅', 'success');
  };

  const [adminPassForm, setAdminPassForm] = useState({ new: '', confirm: '' });
  const handleUpdateAdminPassword = () => {
      if (!adminPassForm.new || adminPassForm.new !== adminPassForm.confirm) {
          showNotification('كلمات المرور غير متطابقة', 'error');
          return;
      }
      StorageService.updatePassword(currentUser.id, adminPassForm.new);
      showNotification('تم تحديث كلمة المرور بنجاح ✅', 'success');
      setAdminPassForm({ new: '', confirm: '' });
  };

  const handleSaveTab = () => {
    if (!tabForm.label || !tabForm.icon) {
      showNotification('يرجى ملء الاسم والأيقونة', 'error');
      return;
    }

    if (showTabEditor?.tab) {
      StorageService.updateUserTab(showTabEditor.tab.id, tabForm);
      showNotification('تم تحديث التبويب بنجاح ✅', 'success');
    } else {
      StorageService.addUserTab(tabForm as any);
      showNotification('تم إضافة التبويب بنجاح ✨', 'success');
    }
    setShowTabEditor(null);
    refreshData();
  };

  const handleDeleteTab = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'حذف تبويب',
      message: 'هل أنت متأكد من حذف هذا التبويب؟ لا يمكن التراجع عن هذه العملية.',
      type: 'danger',
      action: () => {
        StorageService.deleteUserTab(id);
        refreshData();
        showNotification('تم حذف التبويب بنجاح 🗑️', 'info');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleMoveTab = (id: string, direction: 'up' | 'down') => {
    const tabs = [...systemSettings.userTabs.tabs].sort((a, b) => a.order - b.order);
    const idx = tabs.findIndex(t => t.id === id);
    if (direction === 'up' && idx > 0) {
      [tabs[idx], tabs[idx - 1]] = [tabs[idx - 1], tabs[idx]];
    } else if (direction === 'down' && idx < tabs.length - 1) {
      [tabs[idx], tabs[idx + 1]] = [tabs[idx + 1], tabs[idx]];
    }
    StorageService.reorderUserTabs(tabs);
    refreshData();
  };

  const handleSaveUser = () => {
        if (!userForm.fullName || (!userForm.email && !userForm.phone) || (!userForm.id && !userForm.password)) {
            showNotification('يرجى ملء كافة الحقول الأساسية (الاسم ورقم الهاتف أو البريد)', 'error');
            return;
        }
        
        if (userForm.role === UserRole.AGENT && !userForm.networkName) {
            showNotification('اسم الشبكة مطلوب للوكلاء', 'error');
            return;
        }

        if (userForm.id) {
             // Update existing
             StorageService.updateUser(userForm.id, userForm);
             StorageService.logAction('تعديل بيانات مستخدم', `تحديث بيانات: ${userForm.fullName}`, currentUser.fullName, 'EDIT');
             showNotification('تم تحديث بيانات المستخدم ✅', 'success');
        } else {
            // Create new
            if (userForm.role === UserRole.AGENT) {
                 StorageService.addAgent(userForm);
            } else {
                 const newUser = { ...userForm, role: userForm.role };
                 StorageService.registerUser(newUser);
            }
            StorageService.logAction('إضافة مستخدم جديد', `إضافة: ${userForm.fullName} (${userForm.role})`, currentUser.fullName, 'EDIT');
        }
        setShowUserModal(false);
        refreshData();
  };

  const handleEditUser = (user: User) => {
      setUserForm({
          id: user.id,
          fullName: user.fullName,
          email: user.email || '',
          phone: user.phone || '',
          password: '', // Password placeholder handled in modal
          role: user.role,
          networkName: user.role === UserRole.AGENT ? (user as Agent).networkName : '',
          profitPercentage: user.role === UserRole.AGENT ? (user as Agent).profitPercentage : 0,
          isActive: user.isActive
      });
      setIsEditMode(true);
      setShowUserModal(true);
  };

  // System Banks Handlers
  const handleSaveSystemBank = () => {
      if(!systemBankForm.bankName || !systemBankForm.accountNumber || !systemBankForm.accountHolder) return showNotification('جميع الحقول مطلوبة', 'error');
      
      if(systemBankForm.id) {
          StorageService.updateBankAccount(systemBankForm.id, systemBankForm);
          showNotification('تم تحديث البنك ✅', 'success');
      } else {
          StorageService.addBankAccount(systemBankForm);
          showNotification('تم إضافة البنك ✅', 'success');
      }
      setShowSystemBankModal(false);
      refreshData();
  };

  const handleDeleteSystemBank = (id: string) => {
      setConfirmModal({
          isOpen: true, title: 'حذف بنك', message: 'هل أنت متأكد من حذف هذا الحساب البنكي؟', type: 'danger',
          action: () => {
              StorageService.deleteBankAccount(id);
              refreshData(); showNotification('تم حذف البنك', 'info'); setConfirmModal({...confirmModal, isOpen: false});
          }
      });
  };

  const handleToggleSystemBank = (bank: BankAccount) => {
      StorageService.updateBankAccount(bank.id, { isActive: !bank.isActive });
      refreshData();
  };

  // Export Data Handler
  const handleExportData = () => {
      const dataStr = JSON.stringify(localStorage);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `quantum_backup_${new Date().toISOString().split('T')[0]}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      showNotification('تم تصدير نسخة احتياطية بنجاح 📦', 'success');
  };

  const handleExportReport = async (elementId: string, filename: string) => {
      const element = document.getElementById(elementId);
      if (!element) return;
      
      const opt = {
          margin: 10,
          filename: `${filename}_${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      try {
          showNotification('جاري تجهيز التقرير... ⏳', 'info');
          await html2pdf().set(opt).from(element).save();
          showNotification('تم تصدير التقرير بنجاح ✅', 'success');
      } catch (err) {
          showNotification('فشل تصدير التقرير', 'error');
      }
  };

  const renderDetailModalContent = () => {
        if (!viewModal) return null;
        const { data, type } = viewModal;
        
        // Handling Sales (Orders)
        if (type === 'مبيعات') {
            const o = data as Order;
            return (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in duration-300">
                    <DetailBox label="رقم العملية" value={o.id} icon="🆔" color="bg-slate-50 border-slate-200 text-slate-700" fullWidth />
                    <DetailBox label="العميل" value={o.userName} icon="👤" color="bg-indigo-50 border-indigo-200 text-indigo-700" />
                    <DetailBox label="الشبكة" value={o.networkName} icon="📡" color="bg-violet-50 border-violet-200 text-violet-700" />
                    <DetailBox label="الفئة" value={o.categoryName} icon="🏷️" color="bg-blue-50 border-blue-200 text-blue-700" />
                    <DetailBox label="سعر البيع" value={`${o.pointsUsed} ن`} icon="💰" color="bg-cyan-50 border-cyan-200 text-cyan-700" />
                    <DetailBox label="ربح النظام" value={`${o.masterProfit.toFixed(2)} ن`} icon="📈" color="bg-emerald-50 border-emerald-200 text-emerald-700" />
                    <DetailBox label="ربح الوكيل" value={`${o.agentEarnings.toFixed(2)} ن`} icon="🤝" color="bg-amber-50 border-amber-200 text-amber-700" />
                    <DetailBox label="التاريخ" value={new Date(o.createdAt).toLocaleString('ar-YE')} icon="📅" color="bg-slate-50 border-slate-200 text-slate-600" fullWidth />
                    <div className="col-span-full bg-slate-900 text-white p-4 rounded-2xl space-y-2 shadow-inner">
                        <div className="flex items-center gap-2 opacity-60 text-[10px] font-black uppercase tracking-widest">
                            <span>🔐</span> بيانات الكرت (مشفر)
                        </div>
                        <code className="block text-xs font-mono break-all text-indigo-300 leading-relaxed">{o.cardNumber}</code>
                    </div>
                </div>
            );
        }

        // Handling Users and Agents
        if (type === 'مستخدم' || type === 'وكيل') {
            const u = data as User;
            const isAgent = u.role === UserRole.AGENT;
            return (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in duration-300">
                    <DetailBox label="الاسم الكامل" value={u.fullName} icon="👤" color="bg-indigo-50 border-indigo-200 text-indigo-700" fullWidth />
                    <DetailBox label="رقم الهاتف" value={u.phone || 'غير متوفر'} icon="📱" color="bg-emerald-50 border-emerald-200 text-emerald-700" />
                    <DetailBox label="البريد الإلكتروني" value={u.email || 'غير متوفر'} icon="📧" color="bg-slate-50 border-slate-200 text-slate-700" />
                    <DetailBox label="نوع الحساب" value={u.role} icon="🛡️" color="bg-violet-50 border-violet-200 text-violet-700" />
                    <DetailBox label="الرصيد الحالي" value={`${u.pointsBalance} ن`} icon="💎" color="bg-cyan-50 border-cyan-200 text-cyan-700" />
                    <DetailBox label="حالة الحساب" value={u.isActive ? 'نشط' : 'موقف'} icon="⚡" color={u.isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'} />
                    <DetailBox label="تاريخ الانضمام" value={new Date(u.createdAt).toLocaleDateString('ar-YE')} icon="📅" color="bg-slate-50 border-slate-200 text-slate-600" />
                    {isAgent && (
                        <>
                            <DetailBox label="اسم الشبكة" value={(u as Agent).networkName} icon="📡" color="bg-blue-50 border-blue-200 text-blue-700" />
                            <DetailBox label="نسبة ربح النظام" value={`${(u as Agent).profitPercentage}%`} icon="📊" color="bg-amber-50 border-amber-200 text-amber-700" />
                        </>
                    )}
                </div>
            );
        }
        
        // Handling Financial Requests (Deposits & Settlements)
        if (type === 'شحن' || type === 'تسوية') {
             const isSettlement = type === 'تسوية';
             const statusColor = data.status === Status.COMPLETED || data.status === Status.PAID ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                               data.status === Status.PENDING ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-rose-50 border-rose-200 text-rose-700';
             return (
                 <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in duration-300">
                     <DetailBox label="رقم الطلب" value={data.id} icon="🆔" color="bg-slate-50 border-slate-200 text-slate-700" fullWidth />
                     <DetailBox label="صاحب الطلب" value={isSettlement ? data.agentName : data.userName} icon="👤" color="bg-indigo-50 border-indigo-200 text-indigo-700" />
                     <DetailBox label="المبلغ" value={`${isSettlement ? data.agentEarnings : data.amount} ن`} icon="💰" color="bg-cyan-50 border-cyan-200 text-cyan-700" />
                     <DetailBox label="حالة الطلب" value={data.status} icon="🔔" color={statusColor} />
                     <DetailBox label="التاريخ" value={new Date(data.createdAt).toLocaleString('ar-YE')} icon="📅" color="bg-slate-50 border-slate-200 text-slate-600" />
                     
                     <div className="col-span-full p-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 space-y-3">
                         <h4 className="font-black text-[10px] text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                             <span>🏦</span> {isSettlement ? 'بيانات البنك (للاستلام)' : 'تفاصيل الدفع (من المستخدم)'}
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                             {isSettlement ? (
                                 <>
                                     <div className="flex justify-between border-b border-indigo-100 pb-1"><span>البنك:</span><span className="font-bold">{data.bankDetails.bankName}</span></div>
                                     <div className="flex justify-between border-b border-indigo-100 pb-1"><span>الحساب:</span><span className="font-mono font-bold">{data.bankDetails.accountNumber}</span></div>
                                     <div className="flex justify-between border-b border-indigo-100 pb-1"><span>المستفيد:</span><span className="font-bold">{data.bankDetails.accountHolder}</span></div>
                                     {data.referenceNumber && <div className="flex justify-between border-b border-indigo-100 pb-1"><span>المرجع:</span><span className="font-mono font-bold">{data.referenceNumber}</span></div>}
                                 </>
                             ) : (
                                 <>
                                     <div className="flex justify-between border-b border-indigo-100 pb-1"><span>الطريقة:</span><span className="font-bold">{data.paymentMethod}</span></div>
                                     <div className="flex justify-between border-b border-indigo-100 pb-1"><span>المرجع:</span><span className="font-mono font-bold">{data.referenceNumber}</span></div>
                                     <div className="flex justify-between border-b border-indigo-100 pb-1"><span>المودع:</span><span className="font-bold">{data.recipientName}</span></div>
                                 </>
                             )}
                         </div>
                     </div>
                     {data.adminNotes && (
                         <div className="col-span-full bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 flex flex-col gap-1">
                             <span className="font-black text-[9px] uppercase tracking-widest opacity-60">📝 ملاحظات الإدارة</span>
                             {data.adminNotes}
                         </div>
                     )}
                 </div>
             );
        }

        // Default fallback (Logs, etc.)
        if (type === 'مراقبة_مستخدم') {
            const u = data as User;
            const userOrders = orders.filter(o => o.userId === u.id);
            const userLogins = systemLogs.filter(l => l.performedBy === u.fullName && l.action === 'تسجيل دخول');
            return (
                <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="grid grid-cols-2 gap-3">
                        <DetailBox label="إجمالي المشتريات" value={`${userOrders.length} كرت`} icon="🛒" color="bg-indigo-50 border-indigo-200 text-indigo-700" />
                        <DetailBox label="إجمالي المدفوعات" value={`${userOrders.reduce((acc, o) => acc + o.pointsUsed, 0)} ن`} icon="💰" color="bg-emerald-50 border-emerald-200 text-emerald-700" />
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">سجل المشتريات التفصيلي</h4>
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {userOrders.map(o => (
                                <div key={o.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold">{o.categoryName}</p>
                                        <p className="text-[9px] text-slate-400">{o.networkName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-indigo-600">{o.pointsUsed} ن</p>
                                        <p className="text-[9px] text-slate-400" dir="ltr">{new Date(o.createdAt).toLocaleDateString('ar-YE')}</p>
                                    </div>
                                </div>
                            ))}
                            {userOrders.length === 0 && <p className="text-center text-[10px] text-slate-400 py-4">لا توجد مشتريات مسجلة</p>}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">سجل الدخول</h4>
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {userLogins.map(l => (
                                <div key={l.id} className="p-3 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl flex justify-between items-center">
                                    <span className="text-[10px] font-bold">تسجيل دخول ناجح</span>
                                    <span className="text-[10px] font-mono opacity-60" dir="ltr">{new Date(l.timestamp).toLocaleString('ar-YE')}</span>
                                </div>
                            ))}
                            {userLogins.length === 0 && <p className="text-center text-[10px] text-slate-400 py-4">لا توجد سجلات دخول</p>}
                        </div>
                    </div>
                </div>
            );
        }

        if (type === 'نظام' || type === 'تصفير') {
            const l = data as SystemLog;
            return (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in duration-300">
                    <DetailBox label="نوع السجل" value={l.type} icon="📜" color="bg-slate-50 border-slate-200 text-slate-700" />
                    <DetailBox label="بواسطة" value={l.performedBy} icon="👤" color="bg-indigo-50 border-indigo-200 text-indigo-700" />
                    <DetailBox label="التاريخ" value={new Date(l.timestamp).toLocaleString('ar-YE')} icon="📅" color="bg-slate-50 border-slate-200 text-slate-600" fullWidth />
                    <div className="col-span-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs text-slate-700 flex flex-col gap-1">
                        <span className="font-black text-[9px] uppercase tracking-widest opacity-60">📄 تفاصيل الإجراء</span>
                        {l.details}
                    </div>
                </div>
            );
        }

        return (
            <div className="p-8 text-center text-slate-400">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-xs font-bold">لا توجد بيانات إضافية لعرضها</p>
            </div>
        );
  };

  // --- Analytics Logic (REAL DATA) ---
  const analytics = useMemo(() => {
      const activeUsers = users.filter(u => u.role === UserRole.USER && u.isActive).length;
      const totalUsers = users.filter(u => u.role === UserRole.USER).length;
      
      const activeAgents = users.filter(u => u.role === UserRole.AGENT && u.isActive).length;
      const totalAgents = users.filter(u => u.role === UserRole.AGENT).length;

      const activeManagers = users.filter(u => u.role === UserRole.MANAGER && u.isActive).length;
      const totalManagers = users.filter(u => u.role === UserRole.MANAGER).length;

      const totalNetworks = new Set(users.filter(u => u.role === UserRole.AGENT).map(u => (u as Agent).networkName)).size;
      
      const totalCats = categories.length;
      
      const availableCards = allCards.filter(c => c.status === CardStatus.AVAILABLE).length;
      const soldCards = allCards.filter(c => c.status === CardStatus.SOLD).length;

      const totalSalesPoints = orders.reduce((acc, o) => acc + o.pointsUsed, 0);
      const totalAgentEarnings = orders.reduce((acc, o) => acc + o.agentEarnings, 0);
      const totalSystemProfit = orders.reduce((acc, o) => acc + o.masterProfit, 0);

      const pendingPoints = pointRequests.filter(r => r.status === Status.PENDING).length;
      const pendingSettlements = settlements.filter(r => r.status === Status.PENDING).length;
      const acceptedReqs = pointRequests.filter(r => r.status === Status.COMPLETED).length + settlements.filter(r => r.status === Status.PAID).length;
      const rejectedReqs = pointRequests.filter(r => r.status === Status.REJECTED).length + settlements.filter(r => r.status === Status.REJECTED).length;

      // Low Stock Logic with Network Name
      const lowStockItems = categories.filter(c => {
          const count = allCards.filter(k => k.categoryId === c.id && k.status === CardStatus.AVAILABLE).length;
          return count < 5; // Threshold
      }).map(c => {
          const agent = users.find(u => u.id === c.agentId) as Agent;
          return {
              catName: c.name,
              networkName: agent ? agent.networkName : 'غير معروف',
              agentId: c.agentId
          };
      });

      const raw = {
          users: `${activeUsers} / ${totalUsers}`,
          agents: `${activeAgents} / ${totalAgents}`,
          managers: `${activeManagers} / ${totalManagers}`,
          networks: totalNetworks,
          cats: totalCats,
          avail: availableCards,
          sold: soldCards,
          sales: totalSalesPoints,
          earnings: totalAgentEarnings,
          profit: totalSystemProfit,
          finops: pointRequests.length + settlements.length,
          pend_p: pendingPoints,
          pend_s: pendingSettlements,
          appr: acceptedReqs,
          rej: rejectedReqs,
      };

      const getVal = (key: string, val: number | string) => {
          if (typeof val === 'string') return val; 
          const offset = statOffsets[key] || 0;
          return Math.max(0, val - offset);
      };

      return {
          metrics: [
              { key: 'users', title: 'المستخدمين (نشط/كلي)', val: getVal('users', raw.users), raw: raw.users, icon: '👥', color: 'indigo' },
              { key: 'agents', title: 'الوكلاء (نشط/كلي)', val: getVal('agents', raw.agents), raw: raw.agents, icon: '📡', color: 'violet' },
              { key: 'managers', title: 'المدراء (نشط/كلي)', val: getVal('managers', raw.managers), raw: raw.managers, icon: '👔', color: 'purple' },
              { key: 'networks', title: 'عدد الشبكات', val: getVal('networks', raw.networks), raw: raw.networks, icon: '🌐', color: 'sky' },
              { key: 'cats', title: 'عدد الفئات', val: getVal('cats', raw.cats), raw: raw.cats, icon: '🏷️', color: 'slate' },
              { key: 'avail', title: 'كروت متاحة', val: getVal('avail', raw.avail), raw: raw.avail, icon: '🎫', color: 'emerald' },
              { key: 'sold', title: 'كروت مباعة', val: getVal('sold', raw.sold), raw: raw.sold, icon: '📤', color: 'amber' },
              { key: 'sales', title: 'إجمالي المبيعات (ن)', val: typeof raw.sales === 'number' ? (getVal('sales', raw.sales) as number).toLocaleString() : raw.sales, raw: raw.sales, icon: '💎', color: 'cyan' },
              { key: 'earnings', title: 'أرباح الوكلاء', val: typeof raw.earnings === 'number' ? (getVal('earnings', raw.earnings) as number).toFixed(1) : raw.earnings, raw: raw.earnings, icon: '💰', color: 'teal' },
              { key: 'profit', title: 'أرباح النظام', val: typeof raw.profit === 'number' ? (getVal('profit', raw.profit) as number).toFixed(1) : raw.profit, raw: raw.profit, icon: '📈', color: 'green' },
              { key: 'finops', title: 'العمليات المالية', val: getVal('finops', raw.finops), raw: raw.finops, icon: '🏦', color: 'gray' },
              { key: 'pend_p', title: 'شحن معلق', val: getVal('pend_p', raw.pend_p), raw: raw.pend_p, icon: '⏳', color: 'orange' },
              { key: 'pend_s', title: 'تسويات معلقة', val: getVal('pend_s', raw.pend_s), raw: raw.pend_s, icon: '⚖️', color: 'rose' },
              { key: 'appr', title: 'طلبات مقبولة', val: getVal('appr', raw.appr), raw: raw.appr, icon: '✅', color: 'blue' },
              { key: 'rej', title: 'طلبات مرفوضة', val: getVal('rej', raw.rej), raw: raw.rej, icon: '❌', color: 'pink' },
          ],
          notifications: {
              pending: raw.pend_p + raw.pend_s,
              lowStock: lowStockItems
          }
      };
  }, [users, allCards, orders, pointRequests, settlements, categories, statOffsets]);

  // --- Reports Logic ---
  const filteredReportData = useMemo(() => {
      const now = new Date();
      const isWithinRange = (dateStr: string) => {
          const d = new Date(dateStr);
          if (reportTimeFilter === 'DAY') return d.toDateString() === now.toDateString();
          if (reportTimeFilter === 'WEEK') { const ago = new Date(); ago.setDate(now.getDate() - 7); return d >= ago; }
          if (reportTimeFilter === 'MONTH') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          if (reportTimeFilter === 'YEAR') return d.getFullYear() === now.getFullYear();
          if (reportTimeFilter === 'CUSTOM' && customReportDate.start && customReportDate.end) {
              const s = new Date(customReportDate.start); const e = new Date(customReportDate.end); e.setHours(23, 59, 59);
              return d >= s && d <= e;
          }
          return true;
      };

      if (reportTab === 'sales') {
          return orders.filter(o => isWithinRange(o.createdAt));
      } else if (reportTab === 'shipping') {
          return pointRequests.filter(r => isWithinRange(r.createdAt));
      } else if (reportTab === 'agents_perf') {
          return users.filter(u => u.role === UserRole.AGENT);
      } else {
          return users.filter(u => u.role === UserRole.USER && isWithinRange(u.createdAt));
      }
  }, [orders, pointRequests, users, reportTab, reportTimeFilter, customReportDate]);

  // --- Chart Data for Reports ---
  const reportChartData = useMemo(() => {
      if (reportTab !== 'sales' && reportTab !== 'shipping') return null;
      const data = filteredReportData as (Order | PointRequest)[];
      const grouped: Record<string, number> = {};
      
      data.forEach(item => {
          const key = new Date(item.createdAt).toLocaleDateString('ar-YE');
          const val = reportTab === 'sales' ? (item as Order).pointsUsed : (item as PointRequest).amount;
          grouped[key] = (grouped[key] || 0) + val;
      });

      return {
          labels: Object.keys(grouped),
          data: Object.values(grouped)
      };
  }, [filteredReportData, reportTab]);

  // --- Handlers ---
  
  // Request Actions
  const handleRequestAction = (item: PointRequest | SettlementReport, action: 'APPROVE' | 'REJECT' | 'CANCEL' | 'EDIT') => {
      const isSettlement = 'agentEarnings' in item;
      const id = item.id;
      const typeLabel = isSettlement ? 'تسوية' : 'شحن';

      if (action === 'APPROVE') {
          setConfirmModal({
              isOpen: true, title: `قبول طلب ${typeLabel}`, message: 'هل أنت متأكد من قبول هذا الطلب؟',
              type: 'success',
              action: () => {
                  if (isSettlement) StorageService.processSettlement(id, Status.PAID, 'تم الدفع يدوياً');
                  else StorageService.approvePoints(id);
                  StorageService.logAction(`قبول طلب ${typeLabel}`, `تم قبول الطلب رقم ${id}`, currentUser.fullName, 'EDIT');
                  refreshData(); showNotification('تم قبول الطلب ✅', 'success'); setConfirmModal({...confirmModal, isOpen: false});
              }
          });
      } else if (action === 'REJECT') {
          setReasonInput('');
          setConfirmModal({
              isOpen: true, title: `رفض طلب ${typeLabel}`, message: 'يرجى كتابة سبب الرفض:',
              type: 'danger', requireReason: true,
              action: () => {
                  if(!reasonInput) return showNotification('سبب الرفض مطلوب', 'error');
                  if (isSettlement) StorageService.processSettlement(id, Status.REJECTED, reasonInput);
                  else StorageService.updatePointsRequestStatus(id, Status.REJECTED); // Note: Should ideally save reason too
                  StorageService.logAction(`رفض طلب ${typeLabel}`, `تم الرفض: ${reasonInput}`, currentUser.fullName, 'EDIT');
                  refreshData(); showNotification('تم رفض الطلب', 'info'); setConfirmModal({...confirmModal, isOpen: false});
              }
          });
      } else if (action === 'CANCEL') {
          setConfirmModal({
              isOpen: true, title: `إلغاء طلب ${typeLabel}`, message: 'سيتم إلغاء الطلب دون تنفيذ أي عملية.',
              type: 'info',
              action: () => {
                  if (isSettlement) StorageService.processSettlement(id, Status.CANCELLED, 'إلغاء من الإدارة');
                  else StorageService.updatePointsRequestStatus(id, Status.CANCELLED);
                  StorageService.logAction(`إلغاء طلب ${typeLabel}`, `تم إلغاء الطلب رقم ${id}`, currentUser.fullName, 'EDIT');
                  refreshData(); showNotification('تم الإلغاء', 'info'); setConfirmModal({...confirmModal, isOpen: false});
              }
          });
      } else if (action === 'EDIT') {
          const currentVal = isSettlement ? (item as SettlementReport).agentEarnings : (item as PointRequest).amount;
          setAmountInput(currentVal.toString());
          setConfirmModal({
              isOpen: true, title: `تعديل قيمة الطلب`, message: 'أدخل القيمة الجديدة:',
              type: 'info', requireAmount: true, currentAmount: currentVal,
              action: () => {
                  const val = parseFloat(amountInput);
                  if(!val || val <= 0) return showNotification('قيمة غير صحيحة', 'error');
                  if (isSettlement) StorageService.updateSettlementAmount(id, val);
                  else StorageService.updatePointsRequestAmount(id, val);
                  StorageService.logAction(`تعديل طلب ${typeLabel}`, `تعديل القيمة من ${currentVal} إلى ${val}`, currentUser.fullName, 'EDIT');
                  refreshData(); showNotification('تم التعديل ✅', 'success'); setConfirmModal({...confirmModal, isOpen: false});
              }
          });
      }
  };

  // Other Handlers (Reset, Save User, etc. - Kept from previous version)
  const handleResetStat = (key: string, title: string, val: any) => {
      // Logic for reset (using offset)
      const numVal = typeof val === 'number' ? val : 0;
      setConfirmModal({
          isOpen: true, title: 'تصفير الإحصائية', message: `هل أنت متأكد من تصفير ${title}؟`, type: 'info',
          action: () => {
              StorageService.setStatOffset(key, numVal);
              StorageService.logAction('تصفير إحصائية', `تصفير ${title}`, currentUser.fullName, 'RESET');
              refreshData(); showNotification('تم التصفير', 'success'); setConfirmModal({...confirmModal, isOpen: false});
          }
      });
  };

  const handleGlobalReset = () => {
      setConfirmModal({ isOpen: true, type: 'danger', title: 'تصفير النظام', message: 'تحذير: حذف كافة البيانات!', requirePin: true, action: () => StorageService.resetSystem() });
  };
  
  const verifyPinAndExecute = () => {
      if (pinInput !== '0000') { showNotification('PIN خطأ', 'error'); return; }
      confirmModal.action();
      setPinInput('');
      setConfirmModal({ ...confirmModal, isOpen: false });
  };

  // --- Combined Requests Data ---
  const combinedRequests = useMemo(() => {
      const pReqs = pointRequests.map(p => ({ ...p, type: 'DEPOSIT' as const }));
      const sReqs = settlements.map(s => ({ ...s, type: 'WITHDRAW' as const }));
      let combined = [...pReqs, ...sReqs].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (requestFilter !== 'ALL') {
          combined = combined.filter(r => r.type === requestFilter);
      }
      return combined;
  }, [pointRequests, settlements, requestFilter]);

  // --- Activity Log Data (Re-used) ---
  const activityLog = useMemo(() => {
    let allActivities = [
        ...orders.map(o => ({ id: o.id, user: o.userName, details: `شراء: ${o.categoryName}`, network: o.networkName, value: o.pointsUsed, date: o.createdAt, type: 'مبيعات', status: 'مكتمل', original: o })),
        ...pointRequests.map(p => ({ id: p.id, user: p.userName, details: `إيداع: ${p.paymentMethod}`, network: 'النظام', value: p.amount, date: p.createdAt, type: 'شحن', status: p.status, original: p })),
        ...settlements.map(s => ({ id: s.id, user: s.agentName, details: `سحب: ${s.bankDetails.bankName}`, network: s.networkName, value: s.agentEarnings, date: s.createdAt, type: 'تسوية', status: s.status, original: s })),
        ...systemLogs.map(l => ({ id: l.id, user: l.performedBy, details: l.details, network: 'إداري', value: '-', date: l.timestamp, type: l.type === 'RESET' ? 'تصفير' : 'نظام', status: 'منفذ', original: l }))
    ];
    if (logFilter !== 'ALL') {
        allActivities = allActivities.filter(act => {
            switch(logFilter) {
                case 'SALES': return act.type === 'مبيعات';
                case 'DEPOSITS': return act.type === 'شحن';
                case 'SETTLEMENTS': return act.type === 'تسوية';
                case 'SYSTEM': return act.type === 'نظام' || act.type === 'تصفير';
                case 'AGENTS': return act.type === 'تسوية' || (act.type === 'نظام' && act.details.includes('وكيل'));
                case 'USERS': return act.type === 'شحن' || act.type === 'مبيعات';
                default: return true;
            }
        });
    }
    if (logSearch) {
        const s = logSearch.toLowerCase();
        allActivities = allActivities.filter(act => 
            act.user.toLowerCase().includes(s) || 
            act.details.toLowerCase().includes(s) || 
            act.network.toLowerCase().includes(s)
        );
    }
    return allActivities.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100);
  }, [orders, pointRequests, settlements, systemLogs, logFilter, logSearch]);

  const menuItems = [
    { id: 'home', label: 'الرئيسية', icon: '🏠' },
    { id: 'activity_log', label: 'سجل النشاط المتقدم', icon: '📜' },
    { id: 'requests', label: 'طلبات الشحن والدفع', icon: '💳' },
    { id: 'agents', label: 'الوكلاء والشبكات', icon: '📡' },
    { id: 'managers', label: 'المدراء', icon: '👔' },
    { id: 'finance', label: 'المالية', icon: '💰' },
    { id: 'banks', label: 'البنوك', icon: '🏦' },
    { id: 'reports', label: 'التقارير', icon: '📊' },
    { id: 'monitoring', label: 'مراقبة المستخدمين', icon: '👁️' },
    { id: 'settings', label: 'النظام', icon: '⚙️' },
  ];

  const logFilters = [ { id: 'ALL', label: 'عرض جميع العمليات' }, { id: 'SALES', label: 'عمليات المبيعات' }, { id: 'DEPOSITS', label: 'طلبات الشحن' }, { id: 'USERS', label: 'عمليات المستخدمين' }, { id: 'AGENTS', label: 'عمليات الوكلاء' }, { id: 'SETTLEMENTS', label: 'التسويات المالية' }, { id: 'SYSTEM', label: 'سجلات النظام والإدارة' } ];
  const currentFilterLabel = logFilters.find(f => f.id === logFilter)?.label || 'تصفية';

  const themeGradients: Record<string, string> = {
    'default': 'bg-slate-50 dark:bg-indigo-950',
    'blue': 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-indigo-950 dark:to-blue-900',
    'emerald': 'bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-slate-900 dark:to-emerald-950',
    'rose': 'bg-gradient-to-br from-rose-50 to-purple-100 dark:from-indigo-950 dark:to-rose-950',
    'amber': 'bg-gradient-to-br from-amber-50 to-orange-100 dark:from-slate-900 dark:to-amber-950',
    'sky': 'bg-gradient-to-br from-sky-50 to-blue-100 dark:from-slate-900 dark:to-sky-950',
    'mint': 'bg-gradient-to-br from-teal-50 to-emerald-100 dark:from-slate-900 dark:to-teal-950',
    'sunset': 'bg-gradient-to-br from-orange-50 to-rose-100 dark:from-slate-900 dark:to-orange-950',
    'lavender': 'bg-gradient-to-br from-violet-50 to-purple-100 dark:from-slate-900 dark:to-violet-950',
    'cloud': 'bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800',
    'peach': 'bg-gradient-to-br from-orange-50 to-amber-100 dark:from-slate-900 dark:to-orange-900',
    'ocean': 'bg-gradient-to-br from-cyan-50 to-blue-200 dark:from-slate-900 dark:to-cyan-950',
    'forest': 'bg-gradient-to-br from-emerald-50 to-green-200 dark:from-slate-900 dark:to-emerald-950',
    'candy': 'bg-gradient-to-br from-pink-50 to-rose-100 dark:from-slate-900 dark:to-pink-950',
    'dark': 'bg-gradient-to-br from-slate-900 to-black dark:from-black dark:to-slate-900',
    'midnight': 'bg-gradient-to-br from-indigo-900 via-slate-900 to-black dark:from-black dark:via-indigo-950 dark:to-slate-900'
  };

  return (
    <div className={`min-h-screen ${themeGradients[adminTheme] || themeGradients.default} flex transition-all duration-500 text-sm overflow-x-hidden`}>
      
      {/* Sidebar */}
      <aside className={`fixed top-0 right-0 z-50 h-screen bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/5 shadow-2xl transition-transform duration-300 w-64 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:w-0'}`}>
          <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
              <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black">Q</div>
                  <h1 className="font-black text-lg text-indigo-900 dark:text-white">كوانتوم</h1>
              </div>
          </div>
          
          <div className="p-4 flex flex-col items-center border-b border-slate-100 dark:border-white/5">
              <div className="relative group w-20 h-20 mb-3">
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-indigo-500 shadow-md bg-slate-200">
                      {adminAvatar ? (
                          <img src={adminAvatar} alt="Admin" className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">👤</div>
                      )}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1 rounded-full shadow-lg text-[10px]">📷</button>
                  <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />
              </div>
              <h3 className="font-black text-sm">{currentUser.fullName}</h3>
              <p className="text-[10px] text-slate-400">مالك النظام</p>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-16rem)]">
              {menuItems.map(item => (
                  <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-xs ${activeSection === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                  </button>
              ))}
          </nav>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'mr-64' : 'mr-0'} p-4 lg:p-8 max-w-full`}>
          
          <div className="lg:hidden flex justify-between items-center mb-6">
              <h1 className="font-black text-lg">لوحة التحكم</h1>
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-white rounded-lg shadow text-indigo-600">☰</button>
          </div>

          {activeSection === 'home' && (
              <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                  
                  {/* Notifications Panel Link */}
                  {(analytics.notifications.pending > 0 || analytics.notifications.lowStock.length > 0) && (
                      <button onClick={() => { handleNavigate('reports'); setReportTab('agents_perf'); }} className="w-full text-right bg-amber-50 dark:bg-amber-900/10 border-r-4 border-amber-500 p-4 rounded-l-xl shadow-sm flex items-start gap-3 animate-pulse hover:bg-amber-100 transition-colors cursor-pointer">
                          <div className="text-2xl">🔔</div>
                          <div>
                              <h4 className="font-black text-sm text-amber-800 dark:text-amber-500">تنبيهات النظام (اضغط للتفاصيل)</h4>
                              <ul className="text-[11px] list-disc list-inside mt-1 space-y-1 text-amber-700 dark:text-amber-400 font-bold">
                                  {analytics.notifications.pending > 0 && <li>يوجد {analytics.notifications.pending} طلبات معلقة (شحن/تسوية) تحتاج للمراجعة.</li>}
                                  {analytics.notifications.lowStock.map((alert, idx) => (
                                      <li key={idx}>تحذير: نفاد مخزون فئة "{alert.catName}" - شبكة "{alert.networkName}"</li>
                                  ))}
                              </ul>
                          </div>
                      </button>
                  )}

                  {/* 15 Real Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      {analytics.metrics.map(({ key, ...m }) => (
                          <StatCard key={key} {...m} onReset={() => handleResetStat(key, m.title, m.raw)} />
                      ))}
                  </div>

                  {/* Quick Activity Preview */}
                  <div className="glass-card rounded-[1.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                      <div className="p-4 bg-white dark:bg-white/5 border-b dark:border-white/10 flex justify-between items-center">
                          <h3 className="font-black text-sm text-slate-800 dark:text-slate-200">آخر النشاطات</h3>
                          <button onClick={() => handleNavigate('activity_log')} className="text-[10px] font-black text-indigo-600 hover:underline">عرض السجل الكامل</button>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-right text-[11px] border-collapse">
                              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                                  {activityLog.slice(0, 5).map((act) => (
                                      <tr key={act.id} className="hover:bg-indigo-50/30 dark:hover:bg-white/5 transition-colors">
                                          <td className="p-3 font-bold">{act.user}</td>
                                          <td className="p-3 text-slate-500">{act.details}</td>
                                          <td className="p-3 text-center font-mono font-black">{act.value}</td>
                                          <td className="p-3 text-center text-[10px] text-slate-400" dir="ltr">{new Date(act.date).toLocaleTimeString('ar-YE')}</td>
                                          <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-[9px] ${act.type==='مبيعات'?'bg-cyan-100':act.type==='شحن'?'bg-emerald-100':act.type==='تسوية'?'bg-amber-100':'bg-slate-200'}`}>{act.type}</span></td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          )}

          {/* ADVANCED ACTIVITY LOG SECTION */}
          {activeSection === 'activity_log' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <SectionHeader title="سجل النشاط المتقدم" subtitle="مراقبة شاملة لجميع العمليات المالية والإدارية في النظام" />
                  
                  <div className="glass-card rounded-[1.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                      <div className="p-4 bg-white dark:bg-white/5 border-b dark:border-white/10 space-y-4">
                          <div className="flex justify-between items-center">
                              <h3 className="font-black text-sm text-slate-800 dark:text-slate-200">الفلاتر والبحث</h3>
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold border border-indigo-100">مباشر • Live</span>
                          </div>
                          
                          <div className="flex flex-col md:flex-row gap-2">
                              <div className="relative flex-1">
                                  <input type="text" placeholder="بحث شامل (اسم، تفاصيل، شبكة)..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="w-full p-3 pr-10 rounded-xl bg-slate-50 dark:bg-indigo-950/50 border border-slate-200 dark:border-white/10 text-xs font-bold focus:outline-none focus:border-indigo-500 transition-all" />
                                  <span className="absolute right-3 top-3 text-slate-400">🔍</span>
                              </div>
                              <div className="relative">
                                  <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`w-full md:w-auto h-full px-4 py-3 rounded-xl text-xs font-black transition-all border flex items-center justify-between gap-3 ${isFilterOpen || logFilter !== 'ALL' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-indigo-950/50 text-slate-600 dark:text-slate-300 border-slate-200 hover:bg-slate-100'}`}><span>🌪️ {currentFilterLabel}</span><span className="text-[10px] opacity-70">▼</span></button>
                                  {isFilterOpen && (
                                      <div className="absolute top-full right-0 mt-2 w-full md:w-56 bg-white dark:bg-indigo-950 border border-slate-100 dark:border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in duration-200">
                                          {logFilters.map(f => (
                                              <button key={f.id} onClick={() => { setLogFilter(f.id); setIsFilterOpen(false); }} className={`w-full text-right px-4 py-3 text-[11px] font-bold hover:bg-slate-50 border-b border-slate-50 last:border-0 ${logFilter === f.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>{f.label}</button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>

                      <div className="overflow-x-auto min-h-[400px]">
                          <table className="w-full text-right text-[11px] border-collapse whitespace-nowrap">
                              <thead className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10">
                                  <tr><th className="p-3">المستخدم / الوكيل</th><th className="p-3">التفاصيل</th><th className="p-3">المصدر</th><th className="p-3 text-center">القيمة</th><th className="p-3 text-center">التوقيت</th><th className="p-3 text-center">النوع</th><th className="p-3 text-center w-24">إجراء</th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                                  {activityLog.map((act) => (
                                      <tr key={act.id} className="hover:bg-indigo-50/30 dark:hover:bg-white/5 transition-colors group">
                                          <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{act.user}</td>
                                          <td className="p-3 text-slate-500">{act.details}</td>
                                          <td className="p-3 text-indigo-600">{act.network}</td>
                                          <td className="p-3 text-center font-mono font-black">{act.value}</td>
                                          <td className="p-3 text-center text-[10px] text-slate-400" dir="ltr">{new Date(act.date).toLocaleString('ar-YE')}</td>
                                          <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-[9px] ${act.type==='مبيعات'?'bg-cyan-100':act.type==='شحن'?'bg-emerald-100':act.type==='تسوية'?'bg-amber-100':'bg-slate-200'}`}>{act.type}</span></td>
                                          <td className="p-3 text-center"><button onClick={() => { setViewModal({ isOpen: true, title: 'تفاصيل العملية', data: act.original, type: act.type }); StorageService.logAction('عرض تفاصيل', `عرض تفاصيل عملية ${act.type}`, currentUser.fullName, 'SYSTEM'); }} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-600 hover:text-white transition-colors">عرض</button></td>
                                      </tr>
                                  ))}
                                  {activityLog.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-400 font-bold">لا توجد سجلات مطابقة للبحث</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          )}

          {/* NEW SECTION: SHIPPING & PAYMENT REQUESTS */}
          {activeSection === 'requests' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <SectionHeader title="طلبات الشحن والدفع" subtitle="إدارة طلبات شحن نقاط المستخدمين وتسويات الوكلاء" />
                  
                  <div className="glass-card rounded-[2rem] border overflow-hidden">
                      <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                          <h3 className="font-bold">قائمة الطلبات المعلقة</h3>
                          <div className="flex gap-2">
                              <button onClick={() => setRequestFilter('ALL')} className={`px-4 py-2 rounded-xl text-xs font-bold ${requestFilter==='ALL'?'bg-indigo-600 text-white':'bg-white text-slate-500'}`}>الكل</button>
                              <button onClick={() => setRequestFilter('DEPOSIT')} className={`px-4 py-2 rounded-xl text-xs font-bold ${requestFilter==='DEPOSIT'?'bg-emerald-600 text-white':'bg-white text-slate-500'}`}>شحن نقاط</button>
                              <button onClick={() => setRequestFilter('WITHDRAW')} className={`px-4 py-2 rounded-xl text-xs font-bold ${requestFilter==='WITHDRAW'?'bg-amber-600 text-white':'bg-white text-slate-500'}`}>تسويات مالية</button>
                          </div>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                              <thead className="bg-slate-100 text-slate-600 font-black">
                                  <tr><th className="p-4">الاسم</th><th className="p-4">النوع</th><th className="p-4">القيمة</th><th className="p-4">التفاصيل / البنك</th><th className="p-4">التاريخ</th><th className="p-4">الحالة</th><th className="p-4 text-center">تحكم</th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-bold">
                                  {combinedRequests.map(item => {
                                      const isSettlement = item.type === 'WITHDRAW';
                                      const val = isSettlement ? (item as SettlementReport).agentEarnings : (item as PointRequest).amount;
                                      const name = isSettlement ? (item as SettlementReport).agentName : (item as PointRequest).userName;
                                      const details = isSettlement ? (item as SettlementReport).bankDetails.bankName : (item as PointRequest).paymentMethod;
                                      const ref = isSettlement ? (item as SettlementReport).bankDetails.accountNumber : (item as PointRequest).referenceNumber;

                                      return (
                                          <tr key={item.id} className="hover:bg-slate-50">
                                              <td className="p-4">{name}</td>
                                              <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] ${isSettlement ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{isSettlement ? 'تسوية وكيل' : 'شحن مستخدم'}</span></td>
                                              <td className="p-4 font-black">{val}</td>
                                              <td className="p-4 text-[10px] opacity-70">{details} <br/> <span className="font-mono">{ref}</span></td>
                                              <td className="p-4 text-[10px] opacity-50" dir="ltr">{new Date(item.createdAt).toLocaleDateString()}</td>
                                              <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] ${item.status === Status.PENDING ? 'bg-blue-100 text-blue-600' : item.status === Status.COMPLETED || item.status === Status.PAID ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{item.status}</span></td>
                                              <td className="p-4">
                                                  {item.status === Status.PENDING && (
                                                      <div className="flex justify-center gap-2">
                                                          <button onClick={() => handleRequestAction(item, 'APPROVE')} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="قبول">✅</button>
                                                          <button onClick={() => handleRequestAction(item, 'REJECT')} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100" title="رفض">❌</button>
                                                          <button onClick={() => handleRequestAction(item, 'EDIT')} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="تعديل">✏️</button>
                                                          <button onClick={() => handleRequestAction(item, 'CANCEL')} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="إلغاء">🚫</button>
                                                          <button onClick={() => setViewModal({ isOpen: true, title: isSettlement ? 'تفاصيل التسوية' : 'تفاصيل الشحن', data: item, type: isSettlement ? 'تسوية' : 'شحن' })} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="عرض">👁️</button>
                                                      </div>
                                                  )}
                                              </td>
                                          </tr>
                                      );
                                  })}
                                  {combinedRequests.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">لا توجد طلبات مطابقة</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          )}

          {/* REPORTS SECTION (UPDATED) */}
          {activeSection === 'reports' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <SectionHeader title="التقارير والإحصائيات" subtitle="كشوفات المبيعات وسجلات المستخدمين" />
                      <button 
                          onClick={() => handleExportReport('report-content', `report_${reportTab}`)}
                          className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-slate-700 flex items-center gap-2 transition-all"
                      >
                          <span>🖨️</span> تصدير التقرير (PDF)
                      </button>
                  </div>
                  
                  {/* Report Tabs */}
                  <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                      <button onClick={() => setReportTab('sales')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='sales'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>كشف المبيعات</button>
                      <button onClick={() => setReportTab('shipping')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='shipping'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>تقارير الشحن</button>
                      <button onClick={() => setReportTab('users')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='users'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>المستخدمين الجدد</button>
                      <button onClick={() => setReportTab('agents_perf')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='agents_perf'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>أداء الوكلاء 📡</button>
                  </div>

                  {/* Time Filter (Common for Sales/Shipping) */}
                  {reportTab !== 'users' && reportTab !== 'agents_perf' && (
                      <div className="glass-card p-4 rounded-xl flex flex-wrap gap-2 items-center mb-4">
                          <span className="text-xs font-bold text-slate-500 ml-2">الفترة الزمنية:</span>
                          {['DAY','WEEK','MONTH','YEAR'].map(t => (
                              <button key={t} onClick={() => setReportTimeFilter(t as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black ${reportTimeFilter===t ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-500'}`}>
                                  {t==='DAY'?'يومي':t==='WEEK'?'أسبوعي':t==='MONTH'?'شهري':'سنوي'}
                              </button>
                          ))}
                          <button onClick={() => setReportTimeFilter('CUSTOM')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${reportTimeFilter==='CUSTOM' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500'}`}>تخصيص</button>
                          {reportTimeFilter === 'CUSTOM' && (
                              <div className="flex gap-2 mr-auto">
                                  <input type="date" className="p-2 rounded border text-xs" onChange={e => setCustomReportDate({...customReportDate, start: e.target.value})} />
                                  <input type="date" className="p-2 rounded border text-xs" onChange={e => setCustomReportDate({...customReportDate, end: e.target.value})} />
                              </div>
                          )}
                      </div>
                  )}

                  {/* Report Content */}
                  <div id="report-content" className="glass-card p-6 rounded-[2rem] border min-h-[400px] bg-white dark:bg-slate-900">
                      {reportTab === 'sales' && (
                          <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                  <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl border border-cyan-100 dark:border-cyan-900/30">
                                      <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">إجمالي المبيعات</p>
                                      <h4 className="text-2xl font-black text-cyan-700 dark:text-cyan-400">{(filteredReportData as Order[]).reduce((acc, o) => acc + o.pointsUsed, 0).toLocaleString()} ن</h4>
                                  </div>
                                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">ربح النظام</p>
                                      <h4 className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{(filteredReportData as Order[]).reduce((acc, o) => acc + o.masterProfit, 0).toFixed(2)} ن</h4>
                                  </div>
                                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">عدد العمليات</p>
                                      <h4 className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{(filteredReportData as Order[]).length}</h4>
                                  </div>
                              </div>
                              <h3 className="font-bold text-lg">تحليل المبيعات</h3>
                              {reportChartData && <SimpleBarChart data={reportChartData.data} labels={reportChartData.labels} color="bg-cyan-500" />}
                              <table className="w-full text-right text-xs mt-6">
                                  <thead className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-black"><tr><th className="p-3">التاريخ</th><th className="p-3">العميل</th><th className="p-3">الفئة</th><th className="p-3 text-center">القيمة</th><th className="p-3 text-center">الربح</th></tr></thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                                      {(filteredReportData as Order[]).map(o => (
                                          <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-white/5"><td className="p-3 text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</td><td className="p-3 font-bold">{o.userName}</td><td className="p-3">{o.categoryName}</td><td className="p-3 text-center font-black text-cyan-600">{o.pointsUsed}</td><td className="p-3 text-center text-emerald-600">{o.masterProfit.toFixed(1)}</td></tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      )}

                      {reportTab === 'shipping' && (
                          <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">إجمالي الشحن</p>
                                      <h4 className="text-2xl font-black text-orange-700 dark:text-orange-400">{(filteredReportData as PointRequest[]).reduce((acc, r) => acc + r.amount, 0).toLocaleString()} ن</h4>
                                  </div>
                                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">عدد الطلبات</p>
                                      <h4 className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{(filteredReportData as PointRequest[]).length}</h4>
                                  </div>
                              </div>
                              <h3 className="font-bold text-lg">تحليل عمليات الشحن</h3>
                              {reportChartData && <SimpleBarChart data={reportChartData.data} labels={reportChartData.labels} color="bg-orange-500" />}
                              <table className="w-full text-right text-xs mt-6">
                                  <thead className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-black"><tr><th className="p-3">التاريخ</th><th className="p-3">المستخدم</th><th className="p-3">الطريقة</th><th className="p-3 text-center">المبلغ</th><th className="p-3 text-center">الحالة</th></tr></thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                                      {(filteredReportData as PointRequest[]).map(r => (
                                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5"><td className="p-3 text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td><td className="p-3 font-bold">{r.userName}</td><td className="p-3">{r.paymentMethod}</td><td className="p-3 text-center font-black text-orange-600">{r.amount}</td><td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] ${r.status === Status.COMPLETED ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{r.status}</span></td></tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      )}

                      {reportTab === 'users' && (
                          <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">المستخدمين الجدد</p>
                                      <h4 className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{(filteredReportData as User[]).length}</h4>
                                  </div>
                                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">المستخدمين النشطين</p>
                                      <h4 className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{(filteredReportData as User[]).filter(u => u.isActive).length}</h4>
                                  </div>
                              </div>
                              <h3 className="font-bold text-lg">سجل المستخدمين المسجلين</h3>
                              <table className="w-full text-right text-xs border-collapse">
                                  <thead className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-black">
                                      <tr><th className="p-4">الاسم</th><th className="p-4">البريد</th><th className="p-4">تاريخ التسجيل</th><th className="p-4">نوع الحساب</th><th className="p-4">الحالة</th><th className="p-4 text-center">إجراء</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                                      {(filteredReportData as User[]).map(u => (
                                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                              <td className="p-4">{u.fullName}</td>
                                              <td className="p-4 opacity-70">{u.email}</td>
                                              <td className="p-4" dir="ltr">{new Date(u.createdAt).toLocaleDateString()}</td>
                                              <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px]">مستخدم</span></td>
                                              <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] ${u.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{u.isActive ? 'نشط' : 'موقف'}</span></td>
                                              <td className="p-4 text-center">
                                                  <button onClick={() => setViewModal({isOpen: true, title: 'ملف المستخدم', data: u, type: 'مستخدم'})} className="px-3 py-1 bg-slate-100 dark:bg-white/10 rounded hover:bg-slate-200 text-[10px]">عرض</button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      )}

                      {reportTab === 'agents_perf' && (
                          <div className="space-y-8">
                              {/* Global Agents Summary */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                  <div className="p-5 bg-indigo-600 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                                      <p className="text-[10px] font-bold opacity-80 mb-1 uppercase tracking-widest">إجمالي مبيعات الشبكات</p>
                                      <h4 className="text-2xl font-black">{orders.reduce((acc, o) => acc + o.pointsUsed, 0).toLocaleString()} ن</h4>
                                  </div>
                                  <div className="p-5 bg-emerald-600 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                                      <p className="text-[10px] font-bold opacity-80 mb-1 uppercase tracking-widest">إجمالي ربح النظام</p>
                                      <h4 className="text-2xl font-black">{orders.reduce((acc, o) => acc + o.masterProfit, 0).toFixed(1)} ن</h4>
                                  </div>
                                  <div className="p-5 bg-amber-600 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                                      <p className="text-[10px] font-bold opacity-80 mb-1 uppercase tracking-widest">إجمالي أرباح الوكلاء</p>
                                      <h4 className="text-2xl font-black">{orders.reduce((acc, o) => acc + o.agentEarnings, 0).toFixed(1)} ن</h4>
                                  </div>
                                  <div className="p-5 bg-slate-800 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                                      <p className="text-[10px] font-bold opacity-80 mb-1 uppercase tracking-widest">عدد الوكلاء النشطين</p>
                                      <h4 className="text-2xl font-black">{users.filter(u => u.role === UserRole.AGENT && u.isActive).length}</h4>
                                  </div>
                              </div>

                              {(filteredReportData as Agent[]).map(agent => {
                                  // --- Per Agent Calculations ---
                                  const agentOrders = orders.filter(o => o.agentId === agent.id);
                                  const agentCats = categories.filter(c => c.agentId === agent.id);
                                  const availCards = allCards.filter(c => c.agentId === agent.id && c.status === CardStatus.AVAILABLE).length;
                                  const soldCards = allCards.filter(c => c.agentId === agent.id && c.status === CardStatus.SOLD).length;
                                  
                                  // Financials
                                  const totalSalesPoints = agentOrders.reduce((acc, o) => acc + o.pointsUsed, 0);
                                  const totalMasterProfit = agentOrders.reduce((acc, o) => acc + o.masterProfit, 0);
                                  const totalAgentEarnings = agentOrders.reduce((acc, o) => acc + o.agentEarnings, 0);

                                  // Apply Offset Logic for Reset
                                  const reportKey = `agent_report_${agent.id}`;
                                  const offsetSalesPoints = statOffsets[`${reportKey}_sales`] || 0;
                                  const offsetProfit = statOffsets[`${reportKey}_profit`] || 0;
                                  const offsetEarnings = statOffsets[`${reportKey}_earnings`] || 0;
                                  const offsetOrders = statOffsets[`${reportKey}_orders`] || 0;

                                  const displaySalesPoints = Math.max(0, totalSalesPoints - offsetSalesPoints);
                                  const displayProfit = Math.max(0, totalMasterProfit - offsetProfit);
                                  const displayEarnings = Math.max(0, totalAgentEarnings - offsetEarnings);
                                  // We can simulate order reset by filtering out old ones if we tracked reset date, 
                                  // but here we just zero the totals for the visual report as requested.

                                  return (
                                      <div key={agent.id} className="border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 bg-slate-50/50 dark:bg-white/5">
                                          {/* Agent Report Header */}
                                          <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/10 pb-4">
                                              <div className="flex items-center gap-4">
                                                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl">📡</div>
                                                  <div>
                                                      <h3 className="font-black text-lg">{agent.networkName}</h3>
                                                      <p className="text-xs text-slate-500 font-bold">{agent.fullName}</p>
                                                  </div>
                                              </div>
                                              <button 
                                                  onClick={() => setConfirmModal({
                                                      isOpen: true, title: 'تصفير تقرير الوكيل', message: 'هل أنت متأكد من تصفير إحصائيات هذا التقرير؟ (إجراء للعرض فقط)', type: 'info',
                                                      action: () => {
                                                          StorageService.setStatOffset(`${reportKey}_sales`, totalSalesPoints);
                                                          StorageService.setStatOffset(`${reportKey}_profit`, totalMasterProfit);
                                                          StorageService.setStatOffset(`${reportKey}_earnings`, totalAgentEarnings);
                                                          StorageService.logAction('تصفير تقرير', `تصفير تقرير الوكيل ${agent.networkName}`, currentUser.fullName, 'RESET');
                                                          refreshData(); showNotification('تم تصفير التقرير ✅'); setConfirmModal({...confirmModal, isOpen:false});
                                                      }
                                                  })} 
                                                  className="p-3 bg-slate-200 dark:bg-white/10 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors" title="تصفير التقرير"
                                              >
                                                  🔄
                                              </button>
                                          </div>

                                          {/* Top Stats */}
                                          <div className="grid grid-cols-3 gap-4 mb-6">
                                              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl text-center shadow-sm">
                                                  <span className="block text-[10px] text-slate-400 font-black mb-1">الفئات</span>
                                                  <span className="font-black text-lg">{agentCats.length}</span>
                                              </div>
                                              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl text-center shadow-sm border border-emerald-100 dark:border-emerald-900/30">
                                                  <span className="block text-[10px] text-emerald-600 font-black mb-1">كروت متاحة</span>
                                                  <span className="font-black text-lg text-emerald-700 dark:text-emerald-400">{availCards}</span>
                                              </div>
                                              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-center shadow-sm border border-amber-100 dark:border-amber-900/30">
                                                  <span className="block text-[10px] text-amber-600 font-black mb-1">كروت مباعة</span>
                                                  <span className="font-black text-lg text-amber-700 dark:text-amber-400">{soldCards}</span>
                                              </div>
                                          </div>

                                          {/* Transaction Table */}
                                          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 mb-6 bg-white dark:bg-slate-900">
                                              <table className="w-full text-right text-[10px]">
                                                  <thead className="bg-slate-100 dark:bg-white/5 font-black text-slate-500">
                                                      <tr><th className="p-3">المستخدم</th><th className="p-3">التاريخ</th><th className="p-3">العدد</th><th className="p-3">الفئة</th></tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                                                      {agentOrders.slice(0, 10).map(o => (
                                                          <tr key={o.id}>
                                                              <td className="p-3">{o.userName}</td>
                                                              <td className="p-3 opacity-60" dir="ltr">{new Date(o.createdAt).toLocaleString('ar-YE')}</td>
                                                              <td className="p-3">1</td>
                                                              <td className="p-3">{o.categoryName}</td>
                                                          </tr>
                                                      ))}
                                                      {agentOrders.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">لا توجد مبيعات</td></tr>}
                                                  </tbody>
                                              </table>
                                          </div>

                                          {/* Financial Footer */}
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center bg-slate-100 dark:bg-white/5 p-4 rounded-xl">
                                              <div>
                                                  <p className="text-[9px] text-slate-500 font-black">إجمالي المبيعات</p>
                                                  <p className="font-black text-sm">{displaySalesPoints.toLocaleString()} ن</p>
                                              </div>
                                              <div>
                                                  <p className="text-[9px] text-slate-500 font-black">عدد العمليات</p>
                                                  <p className="font-black text-sm">{agentOrders.length}</p>
                                              </div>
                                              <div>
                                                  <p className="text-[9px] text-slate-500 font-black">ربح النظام ({agent.profitPercentage}%)</p>
                                                  <p className="font-black text-sm text-indigo-600">{displayProfit.toFixed(1)} ن</p>
                                              </div>
                                              <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg py-1">
                                                  <p className="text-[9px] text-emerald-700 font-black">ربح الوكيل</p>
                                                  <p className="font-black text-sm text-emerald-800 dark:text-emerald-400">{displayEarnings.toFixed(1)} ن</p>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>
          )}
          
          {/* USER MONITORING SECTION */}
          {activeSection === 'monitoring' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <SectionHeader title="مراقبة المستخدمين والنشاط" subtitle="متابعة عمليات الدخول، المشتريات، وإدارة الحظر" />
                  
                  <div className="grid grid-cols-1 gap-6">
                      {users.filter(u => u.role === UserRole.USER).map(user => {
                          const userOrders = orders.filter(o => o.userId === user.id);
                          const userLogins = systemLogs.filter(l => l.performedBy === user.fullName && l.action === 'تسجيل دخول');
                          
                          // Calculate purchase stats
                          const purchaseStats = userOrders.reduce((acc, o) => {
                              acc.total += 1;
                              acc.categories.add(o.categoryName);
                              acc.networks.add(o.networkName);
                              return acc;
                          }, { total: 0, categories: new Set<string>(), networks: new Set<string>() });

                          return (
                              <div key={user.id} className="glass-card p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 hover:shadow-xl transition-all duration-300">
                                  <div className="flex flex-col md:flex-row justify-between gap-6">
                                      {/* User Info & Status */}
                                      <div className="flex items-start gap-4 flex-1">
                                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                              {user.isActive ? '👤' : '🚫'}
                                          </div>
                                          <div className="space-y-1">
                                              <h3 className="font-black text-lg text-slate-800 dark:text-white">{user.fullName}</h3>
                                              <p className="text-xs text-slate-500 font-bold">{user.phone || user.email}</p>
                                              <div className="flex gap-2 mt-2">
                                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${user.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                      {user.isActive ? 'حساب نشط' : 'حساب محظور'}
                                                  </span>
                                                  <span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                      رصيد: {user.pointsBalance} ن
                                                  </span>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Purchase Summary */}
                                      <div className="flex-1 grid grid-cols-3 gap-2">
                                          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-center">
                                              <p className="text-[9px] text-slate-400 font-black mb-1">إجمالي الكروت</p>
                                              <p className="font-black text-sm text-indigo-600">{purchaseStats.total}</p>
                                          </div>
                                          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-center">
                                              <p className="text-[9px] text-slate-400 font-black mb-1">الفئات</p>
                                              <p className="font-black text-[10px] truncate" title={Array.from(purchaseStats.categories).join(', ')}>
                                                  {purchaseStats.categories.size > 0 ? Array.from(purchaseStats.categories).join(', ') : '-'}
                                              </p>
                                          </div>
                                          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-center">
                                              <p className="text-[9px] text-slate-400 font-black mb-1">الشبكات</p>
                                              <p className="font-black text-[10px] truncate" title={Array.from(purchaseStats.networks).join(', ')}>
                                                  {purchaseStats.networks.size > 0 ? Array.from(purchaseStats.networks).join(', ') : '-'}
                                              </p>
                                          </div>
                                      </div>

                                      {/* Actions */}
                                      <div className="flex flex-col gap-2 justify-center">
                                          <button 
                                              onClick={() => handleToggleAgent(user)} 
                                              className={`px-6 py-2 rounded-xl font-black text-xs transition-all shadow-sm ${user.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                                          >
                                              {user.isActive ? 'حظر المستخدم 🚫' : 'إلغاء الحظر ✅'}
                                          </button>
                                          <button 
                                              onClick={() => setViewModal({ isOpen: true, title: `سجل نشاط: ${user.fullName}`, data: user, type: 'مراقبة_مستخدم' })}
                                              className="px-6 py-2 bg-slate-100 dark:bg-white/10 rounded-xl font-black text-xs hover:bg-slate-200 transition-all"
                                          >
                                              عرض السجل التفصيلي 📜
                                          </button>
                                      </div>
                                  </div>

                                  {/* Recent Logins Preview */}
                                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">آخر عمليات تسجيل الدخول</h4>
                                      <div className="flex gap-3 overflow-x-auto no-scrollbar">
                                          {userLogins.length > 0 ? userLogins.slice(0, 5).map(login => (
                                              <div key={login.id} className="flex-shrink-0 px-3 py-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30 text-[10px] font-bold">
                                                  <span className="text-indigo-600 ml-2">🕒</span>
                                                  {new Date(login.timestamp).toLocaleString('ar-YE')}
                                              </div>
                                          )) : (
                                              <p className="text-[10px] text-slate-400 italic">لا توجد سجلات دخول مسجلة حالياً</p>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                      {users.filter(u => u.role === UserRole.USER).length === 0 && (
                          <div className="p-12 text-center text-slate-400 font-bold">لا يوجد مستخدمين مسجلين حالياً</div>
                      )}
                  </div>
              </div>
          )}

          {/* UPDATED AGENTS SECTION: Card Layout with Circular Buttons */}
          {activeSection === 'agents' && (
              <div className="space-y-6">
                  <SectionHeader title="الوكلاء والشبكات" action={<button onClick={() => { setUserForm({ id: '', fullName: '', email: '', password: '', role: UserRole.AGENT, networkName: '', profitPercentage: 10, isActive: true }); setIsEditMode(false); setShowUserModal(true); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs">+ وكيل جديد</button>} />
                  <div className="grid grid-cols-1 gap-4">
                      {users.filter(u=>u.role===UserRole.AGENT).map(u => (
                          <div key={u.id} className="glass-card p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-indigo-200 transition-all duration-300">
                              {/* Agent Info */}
                              <div className="flex items-center gap-4 w-full md:w-auto">
                                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-200">📡</div>
                                  <div>
                                      <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight mb-1">{(u as Agent).networkName}</h3>
                                      <p className="text-xs text-slate-500 font-bold mb-1">{u.fullName}</p>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md text-slate-500">{u.phone || u.email}</span>
                                          <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-bold border border-indigo-100">ربح النظام: {(u as Agent).profitPercentage}%</span>
                                      </div>
                                  </div>
                              </div>

                              {/* Circular Control Buttons */}
                              <div className="flex items-center gap-3">
                                  
                                  {/* Toggle Switch */}
                                  <div className="flex flex-col items-center gap-1">
                                      <button 
                                          onClick={() => handleToggleAgent(u)} 
                                          className={`w-12 h-7 rounded-full p-1 flex items-center transition-all duration-300 focus:outline-none shadow-inner ${u.isActive ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}
                                          title={u.isActive ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                                      >
                                          <div className="w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300" />
                                      </button>
                                  </div>

                                  {/* Edit Button */}
                                  <button 
                                      onClick={() => handleEditUser(u)} 
                                      className="group relative w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-indigo-200"
                                      title="تعديل البيانات"
                                  >
                                      <span className="text-lg">✏️</span>
                                  </button>

                                  {/* Delete Button */}
                                  <button 
                                      onClick={() => handleDeleteUser(u)} 
                                      className="group relative w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-rose-200"
                                      title="أرشفة الوكيل"
                                  >
                                      <span className="text-lg">🗑️</span>
                                  </button>
                              </div>
                          </div>
                      ))}
                      {users.filter(u=>u.role===UserRole.AGENT).length === 0 && (
                          <div className="text-center py-12 text-slate-400 font-bold border-2 border-dashed rounded-[2rem]">
                              لا يوجد وكلاء مضافين حالياً
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* MANAGERS SECTION */}
          {activeSection === 'managers' && (
              <div className="space-y-6">
                  <SectionHeader title="المدراء والمشرفين" subtitle="إدارة صلاحيات الوصول الإداري للنظام" action={<button onClick={() => { setUserForm({ id: '', fullName: '', email: '', password: '', role: UserRole.MANAGER, networkName: '', profitPercentage: 0, isActive: true }); setIsEditMode(false); setShowUserModal(true); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs">+ مدير جديد</button>} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {users.filter(u => u.role === UserRole.MANAGER).map(u => (
                          <div key={u.id} className="glass-card p-6 rounded-[2rem] border relative overflow-hidden group">
                              <div className="absolute top-0 left-0 p-4 opacity-10 text-6xl group-hover:scale-110 transition-transform">👔</div>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <h3 className="font-black text-lg">{u.fullName}</h3>
                                      <p className="text-xs text-slate-500">{u.phone || u.email}</p>
                                  </div>
                                  <div className={`w-3 h-3 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                              </div>
                              <div className="flex gap-2 mt-4 border-t pt-4 dark:border-white/10">
                                  <button onClick={() => handleEditUser(u)} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-100">تعديل</button>
                                  <button onClick={() => handleToggleAgent(u)} className={`flex-1 py-2 rounded-xl text-[10px] font-black ${u.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>{u.isActive ? 'تجميد' : 'تنشيط'}</button>
                                  <button onClick={() => handleDeleteUser(u)} className="flex-1 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100">حذف</button>
                              </div>
                          </div>
                      ))}
                      {users.filter(u => u.role === UserRole.MANAGER).length === 0 && (
                          <div className="col-span-full text-center py-12 text-slate-400 font-bold border-2 border-dashed rounded-[2rem]">لا يوجد مدراء إضافيين</div>
                      )}
                  </div>
              </div>
          )}

          {/* FINANCE SECTION */}
          {activeSection === 'finance' && (
              <div className="space-y-6">
                  <SectionHeader title="الإدارة المالية" subtitle="نظرة عامة على الأرباح والتدفقات المالية" />
                  
                  {/* Financial Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="glass-card p-6 rounded-[2.5rem] bg-emerald-600 text-white relative overflow-hidden shadow-xl">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
                          <p className="text-xs font-bold opacity-80 mb-1">إجمالي أرباح النظام</p>
                          <h3 className="text-4xl font-black">{analytics.metrics.find(m => m.key === 'profit')?.val} <span className="text-lg opacity-70">ن</span></h3>
                          <p className="text-[10px] mt-4 opacity-70">صافي ربح النظام من العمولات</p>
                      </div>
                      
                      <div className="glass-card p-6 rounded-[2.5rem] bg-white dark:bg-white/5 border border-amber-200 dark:border-amber-900/30 shadow-sm relative overflow-hidden">
                          <p className="text-xs font-bold text-amber-600 mb-1">مستحقات معلقة (للوكلاء)</p>
                          <h3 className="text-4xl font-black text-slate-800 dark:text-white">
                              {settlements.filter(s => s.status === Status.PENDING).reduce((acc, curr) => acc + curr.agentEarnings, 0).toLocaleString()} <span className="text-lg text-slate-400">ن</span>
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-4">طلبات سحب بانتظار الموافقة</p>
                      </div>

                      <div className="glass-card p-6 rounded-[2.5rem] bg-white dark:bg-white/5 border border-indigo-200 dark:border-indigo-900/30 shadow-sm relative overflow-hidden">
                          <p className="text-xs font-bold text-indigo-600 mb-1">حجم التداول الكلي</p>
                          <h3 className="text-4xl font-black text-slate-800 dark:text-white">
                              {orders.reduce((acc, o) => acc + o.pointsUsed, 0).toLocaleString()} <span className="text-lg text-slate-400">ن</span>
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-4">إجمالي قيمة الكروت المباعة</p>
                      </div>
                  </div>

                  {/* Recent Transactions Table */}
                  <div className="glass-card rounded-[2rem] border overflow-hidden">
                      <div className="p-4 bg-slate-50 dark:bg-white/5 border-b font-bold text-sm">سجل العمليات المالية الأخيرة</div>
                      <table className="w-full text-right text-[10px]">
                          <thead className="bg-slate-100 dark:bg-white/10 font-black text-slate-500">
                              <tr><th className="p-3">النوع</th><th className="p-3">المصدر</th><th className="p-3">المبلغ</th><th className="p-3">الربح/العمولة</th><th className="p-3">التاريخ</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                              {orders.slice(0, 5).map(o => (
                                  <tr key={o.id}>
                                      <td className="p-3"><span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">بيع كرت</span></td>
                                      <td className="p-3">{o.networkName}</td>
                                      <td className="p-3">{o.pointsUsed}</td>
                                      <td className="p-3 text-emerald-600">+{o.masterProfit.toFixed(2)}</td>
                                      <td className="p-3 opacity-60" dir="ltr">{new Date(o.createdAt).toLocaleDateString()}</td>
                                  </tr>
                              ))}
                              {settlements.slice(0, 3).map(s => (
                                  <tr key={s.id}>
                                      <td className="p-3"><span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">سحب أرباح</span></td>
                                      <td className="p-3">{s.networkName}</td>
                                      <td className="p-3 text-rose-600">-{s.agentEarnings}</td>
                                      <td className="p-3">-</td>
                                      <td className="p-3 opacity-60" dir="ltr">{new Date(s.createdAt).toLocaleDateString()}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* BANKS SECTION */}
          {activeSection === 'banks' && (
              <div className="space-y-6">
                  <SectionHeader title="الحسابات البنكية" subtitle="إدارة حسابات استقبال الأموال من المستخدمين والوكلاء" action={<button onClick={() => { setSystemBankForm({id: '', bankName: '', accountNumber: '', accountHolder: '', isActive: true}); setShowSystemBankModal(true); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs">+ حساب جديد</button>} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {banks.map(bank => (
                          <div key={bank.id} className={`glass-card p-6 rounded-[2rem] border transition-all ${bank.isActive ? 'border-indigo-100 dark:border-indigo-900/30' : 'opacity-60 grayscale'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-2xl">🏦</div>
                                  <ToggleSwitch checked={bank.isActive} onChange={() => handleToggleSystemBank(bank)} />
                              </div>
                              <h3 className="font-black text-lg text-slate-800 dark:text-white">{bank.bankName}</h3>
                              <p className="text-xs font-mono font-bold text-slate-500 bg-slate-50 dark:bg-white/5 p-2 rounded-lg mt-2 mb-2 inline-block">{bank.accountNumber}</p>
                              <p className="text-[10px] text-slate-400 font-bold mb-4">{bank.accountHolder}</p>
                              
                              <div className="flex gap-2">
                                  <button onClick={() => { setSystemBankForm(bank); setShowSystemBankModal(true); }} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-100">تعديل</button>
                                  <button onClick={() => handleDeleteSystemBank(bank.id)} className="flex-1 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100">حذف</button>
                              </div>
                          </div>
                      ))}
                      {banks.length === 0 && (
                          <div className="col-span-full text-center py-16 text-slate-400 font-bold border-2 border-dashed rounded-[2rem]">
                              لا توجد حسابات بنكية مضافة للنظام
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* UI CUSTOMIZATION SECTION - REMOVED IN FAVOR OF SETTINGS INTEGRATION */}

          {activeSection === 'settings' && (
             <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
                <SectionHeader title="إعدادات النظام والملف الشخصي" />
                
                {/* Admin Profile & Password */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                    <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">👤 الملف الشخصي والأمان</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 px-1">كلمة المرور الجديدة</label>
                            <input 
                                type="password" 
                                value={adminPassForm.new} 
                                onChange={e => setAdminPassForm({...adminPassForm, new: e.target.value})} 
                                className="w-full p-3 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:bg-slate-900" 
                                placeholder="••••••"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 px-1">تأكيد كلمة المرور</label>
                            <input 
                                type="password" 
                                value={adminPassForm.confirm} 
                                onChange={e => setAdminPassForm({...adminPassForm, confirm: e.target.value})} 
                                className="w-full p-3 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:bg-slate-900" 
                                placeholder="••••••"
                            />
                        </div>
                    </div>
                    <button onClick={handleUpdateAdminPassword} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all">تحديث كلمة المرور</button>
                </div>

                {/* Dashboard Theme (Gradients) */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                    <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">🎨 مظهر لوحة التحكم</h3>
                    <p className="text-[10px] text-slate-500 font-bold">اختر خلفية متدرجة للوحة التحكم الخاصة بك:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.keys(themeGradients).map(t => (
                            <button
                                key={t}
                                onClick={() => setAdminTheme(t)}
                                className={`h-16 rounded-xl border-2 transition-all relative overflow-hidden ${adminTheme === t ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-transparent hover:border-slate-300'}`}
                            >
                                <div className={`absolute inset-0 ${themeGradients[t]}`}></div>
                                {adminTheme === t && <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/20 text-white text-xl">✓</div>}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[8px] text-white font-bold py-0.5 capitalize">{t}</div>
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* General Settings */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                    <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">⚙️ الإعدادات العامة</h3>
                    <div className="flex justify-between items-center"><span className="font-bold text-xs">وضع الصيانة (إيقاف النظام مؤقتاً)</span><ToggleSwitch checked={systemSettings.maintenance} onChange={()=>setSystemSettings({...systemSettings, maintenance:!systemSettings.maintenance})} /></div>
                    
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">إعلان عام (يظهر للجميع)</label>
                        <textarea value={systemSettings.announcement} onChange={e=>setSystemSettings({...systemSettings, announcement:e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold h-20 dark:bg-slate-900" placeholder="اكتب رسالة تظهر في الصفحة الرئيسية..." />
                    </div>
                    
                    <button onClick={handleSaveSettings} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700">حفظ الإعدادات والمظهر</button>
                </div>

                {/* Support Settings */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                    <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">📞 إعدادات الدعم الفني</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">رقم الواتساب</label>
                            <input 
                                type="text" 
                                value={systemSettings.support?.whatsapp || ''} 
                                onChange={(e) => setSystemSettings({
                                    ...systemSettings,
                                    support: { ...systemSettings.support!, whatsapp: e.target.value }
                                })}
                                className="w-full p-3 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:bg-slate-900" 
                                placeholder="مثال: 967700000000"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">البريد الإلكتروني</label>
                            <input 
                                type="email" 
                                value={systemSettings.support?.email || ''} 
                                onChange={(e) => setSystemSettings({
                                    ...systemSettings,
                                    support: { ...systemSettings.support!, email: e.target.value }
                                })}
                                className="w-full p-3 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:bg-slate-900" 
                                placeholder="support@domain.com"
                            />
                        </div>
                        <button 
                            onClick={() => {
                                StorageService.saveSystemSettings(systemSettings);
                                showNotification('تم حفظ إعدادات الدعم الفني بنجاح', 'success');
                            }} 
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all"
                        >
                            حفظ إعدادات الدعم
                        </button>
                    </div>
                </div>

                {/* قسم التحكم بأقسام الوكيل */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                  <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">🛠️ تكوين أقسام الوكيل</h3>
                  <div className="space-y-3">
                    {systemSettings.agentTabs.tabs.map(tab => (
                      <div key={tab.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{tab.icon}</span>
                          <span className="font-bold text-xs">{tab.label}</span>
                        </div>
                        <ToggleSwitch 
                          checked={tab.enabled} 
                          onChange={() => {
                            const newTabs = systemSettings.agentTabs.tabs.map(t => t.id === tab.id ? { ...t, enabled: !t.enabled } : t);
                            const newSettings = { ...systemSettings, agentTabs: { tabs: newTabs } };
                            setSystemSettings(newSettings);
                            StorageService.saveSystemSettings(newSettings);
                            showNotification('تم تحديث إعدادات أقسام الوكيل', 'success');
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* قسم تكوين أقسام المستخدم الديناميكية */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-black text-sm flex items-center gap-2">📱 إدارة أقسام المستخدم القديمة</h3>
                    <button 
                      onClick={() => {
                        setTabForm({ label: '', icon: '', contentType: 'text', content: '', enabled: true });
                        setShowTabEditor({ isOpen: true });
                      }}
                      className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black"
                    >
                      + إضافة تبويب
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {systemSettings.userTabs.tabs.sort((a, b) => a.order - b.order).map((tab, idx, arr) => (
                      <div key={tab.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 group">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button disabled={idx === 0} onClick={() => handleMoveTab(tab.id, 'up')} className="text-[10px] hover:text-indigo-600 disabled:opacity-20">▲</button>
                            <button disabled={idx === arr.length - 1} onClick={() => handleMoveTab(tab.id, 'down')} className="text-[10px] hover:text-indigo-600 disabled:opacity-20">▼</button>
                          </div>
                          <span className="text-lg">{tab.icon}</span>
                          <div>
                            <p className="font-bold text-xs">{tab.label}</p>
                            <p className="text-[8px] opacity-50 uppercase tracking-widest">{tab.contentType}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ToggleSwitch 
                            checked={tab.enabled} 
                            onChange={() => {
                              const newTabs = systemSettings.userTabs.tabs.map(t => t.id === tab.id ? { ...t, enabled: !t.enabled } : t);
                              StorageService.updateUserTabs(newTabs);
                              refreshData();
                              showNotification('تم تحديث حالة التبويب', 'success');
                            }} 
                          />
                          <button 
                            onClick={() => {
                              setTabForm(tab);
                              setShowTabEditor({ isOpen: true, tab });
                            }}
                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                          >
                            ✏️
                          </button>
                          {tab.contentType !== 'builtin' && (
                            <button 
                              onClick={() => handleDeleteTab(tab.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Management */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                    <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">💾 إدارة البيانات</h3>
                    <div className="flex gap-2">
                        <button onClick={handleExportData} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 flex items-center justify-center gap-2"><span>📦</span> تصدير نسخة احتياطية (JSON)</button>
                    </div>
                    <div className="pt-2 border-t dark:border-white/10">
                        <button onClick={handleGlobalReset} className="w-full py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-black text-xs hover:bg-rose-100 flex items-center justify-center gap-2"><span>⚠️</span> تصفير النظام بالكامل</button>
                        <p className="text-[9px] text-rose-400 mt-2 text-center">تحذير: هذا الإجراء سيحذف جميع المستخدمين والعمليات والبيانات نهائياً.</p>
                    </div>
                </div>

                {/* تخصيص واجهة المستخدم (Phase 1) */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4 mt-6">
                  <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">🎨 تخصيص واجهة المستخدم (JSON)</h3>
                  <p className="text-[10px] text-slate-500 font-bold">قم بتعديل هيكل الأقسام الرئيسية والفرعية حسب الرغبة.</p>
                  <textarea
                    value={JSON.stringify(userLayout, null, 2)}
                    onChange={(e) => {
                      try {
                        const newLayout = JSON.parse(e.target.value);
                        setUserLayout(newLayout);
                      } catch (error) {}
                    }}
                    rows={15}
                    className="w-full p-3 font-mono text-[10px] bg-slate-50 dark:bg-slate-900 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50"
                    dir="ltr"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        StorageService.saveUserLayout(userLayout);
                        showNotification('تم حفظ تخطيط لوحة المستخدم ✅', 'success');
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg hover:bg-indigo-700 transition-all"
                    >
                      حفظ التخطيط
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('هل أنت متأكد من إعادة تعيين التخطيط للافتراضي؟')) {
                          const def = StorageService.getDefaultUserLayout();
                          setUserLayout(def);
                          StorageService.saveUserLayout(def);
                          showNotification('تمت إعادة التعيين للافتراضي', 'info');
                        }
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                    >
                      إعادة تعيين
                    </button>
                  </div>
                </div>
             </div>
          )}

      </main>

      {/* --- Modals --- */}
      {viewModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
              <div className="glass-card w-full max-w-lg max-h-[85vh] flex flex-col rounded-[2rem] bg-white dark:bg-indigo-950 shadow-2xl animate-in zoom-in duration-200">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50 dark:bg-white/5 rounded-t-[2rem]">
                      <div>
                          <h3 className="font-black text-lg text-indigo-900 dark:text-white">{viewModal.title}</h3>
                          <p className="text-[10px] text-slate-500 font-bold">معرف: {viewModal.data.id}</p>
                      </div>
                      <button onClick={()=>setViewModal(null)} className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">✕</button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                      {renderDetailModalContent()}
                  </div>
              </div>
          </div>
      )}

      {/* Tab Editor Modal */}
      {showTabEditor?.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="glass-card w-full max-w-lg rounded-[2rem] bg-white dark:bg-indigo-950 shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-black text-lg">{showTabEditor.tab ? 'تعديل تبويب' : 'إضافة تبويب جديد'}</h3>
              <button onClick={() => setShowTabEditor(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">اسم التبويب</label>
                  <input 
                    type="text" 
                    value={tabForm.label} 
                    onChange={e => setTabForm({...tabForm, label: e.target.value})} 
                    className="w-full p-3 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:bg-slate-900" 
                    placeholder="مثلاً: عروض اليوم"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">الأيقونة (Emoji)</label>
                  <input 
                    type="text" 
                    value={tabForm.icon} 
                    onChange={e => setTabForm({...tabForm, icon: e.target.value})} 
                    className="w-full p-3 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:bg-slate-900" 
                    placeholder="🔥"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">نوع المحتوى</label>
                <select 
                  value={tabForm.contentType} 
                  onChange={e => setTabForm({...tabForm, contentType: e.target.value as ContentType})}
                  disabled={tabForm.contentType === 'builtin'}
                  className="w-full p-3 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:bg-slate-900"
                >
                  <option value="text">نص بسيط</option>
                  <option value="html">HTML مخصص</option>
                  <option value="table">جدول بيانات (JSON)</option>
                  <option value="cards">بطاقات عرض (JSON)</option>
                  <option value="stats">إحصائيات النظام</option>
                  <option value="dashboard">لوحة المعلومات (الرئيسية)</option>
                  <option value="user_wallet">محفظة المستخدم (الرصيد والشحن)</option>
                  <option value="transactions_list">سجل العمليات (شراء + شحن)</option>
                  <option value="purchased_cards">الكروت المشتراة (عرض ونسخ)</option>
                  <option value="favorite_networks">الشبكات المفضلة</option>
                  <option value="notifications">الإشعارات</option>
                  <option value="support">الدعم الفني</option>
                  <option value="reports">التقارير والرسوم البيانية</option>
                  <option value="user_summary">ملخص المستخدم (قديم)</option>
                  <option value="full_transactions">سجل العمليات الكامل (قديم)</option>
                  <option value="purchases_only">عمليات الشراء فقط (قديم)</option>
                  <option value="deposits_only">عمليات الشحن فقط (قديم)</option>
                  <option value="networks_summary">الشبكات المشتراة (قديم)</option>
                  <option value="recent_activities">آخر العمليات (قديم)</option>
                  {tabForm.contentType === 'builtin' && <option value="builtin">وظيفة مدمجة</option>}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">المحتوى</label>
                {tabForm.contentType === 'text' && (
                  <textarea 
                    value={tabForm.content} 
                    onChange={e => setTabForm({...tabForm, content: e.target.value})} 
                    className="w-full p-3 border rounded-xl text-xs font-bold h-32 outline-none focus:border-indigo-500 dark:bg-slate-900" 
                    placeholder="اكتب النص هنا..."
                  />
                )}
                {tabForm.contentType === 'html' && (
                  <textarea 
                    value={tabForm.content} 
                    onChange={e => setTabForm({...tabForm, content: e.target.value})} 
                    className="w-full p-3 border rounded-xl text-xs font-mono h-32 outline-none focus:border-indigo-500 dark:bg-slate-900" 
                    placeholder="<div class='p-4'>...</div>"
                  />
                )}
                {(tabForm.contentType === 'table' || tabForm.contentType === 'cards' || tabForm.contentType === 'stats') && (
                  <textarea 
                    value={typeof tabForm.content === 'string' ? tabForm.content : JSON.stringify(tabForm.content, null, 2)} 
                    onChange={e => {
                      try {
                        const val = JSON.parse(e.target.value);
                        setTabForm({...tabForm, content: val});
                      } catch (err) {
                        setTabForm({...tabForm, content: e.target.value});
                      }
                    }} 
                    className="w-full p-3 border rounded-xl text-xs font-mono h-32 outline-none focus:border-indigo-500 dark:bg-slate-900" 
                    placeholder="{ ... }"
                  />
                )}
                {tabForm.contentType === 'builtin' && (
                  <div className="p-4 bg-slate-50 rounded-xl text-[10px] font-bold text-slate-500">
                    هذا التبويب مرتبط بوظيفة مدمجة في النظام (مثل التسوق أو الإعدادات) ولا يمكن تعديل محتواه يدوياً.
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold">تفعيل التبويب</span>
                <ToggleSwitch checked={tabForm.enabled || false} onChange={() => setTabForm({...tabForm, enabled: !tabForm.enabled})} />
              </div>

              <button 
                onClick={handleSaveTab}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all"
              >
                حفظ التبويب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Confirm Modal (Approve/Reject/Edit) */}
      {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-indigo-900 w-full max-w-sm p-6 rounded-2xl shadow-xl text-center space-y-4">
                  <div className="text-4xl">{confirmModal.type==='success'?'✅':confirmModal.type==='danger'?'⚠️':'ℹ️'}</div>
                  <h3 className="font-bold text-lg">{confirmModal.title}</h3>
                  <p className="text-xs text-slate-500">{confirmModal.message}</p>
                  
                  {confirmModal.requireReason && <textarea placeholder="سبب الرفض..." value={reasonInput} onChange={e => setReasonInput(e.target.value)} className="w-full p-3 border rounded text-xs h-20" />}
                  {confirmModal.requireAmount && <input type="number" placeholder="القيمة الجديدة" value={amountInput} onChange={e => setAmountInput(e.target.value)} className="w-full p-3 border rounded text-center font-black" />}
                  {confirmModal.requirePin && <input type="password" placeholder="PIN" value={pinInput} onChange={e=>setPinInput(e.target.value)} className="w-full p-2 border rounded text-center" />}
                  
                  <div className="flex gap-2">
                      <button onClick={()=>setConfirmModal({...confirmModal, isOpen:false})} className="flex-1 py-2 bg-slate-100 rounded">إلغاء</button>
                      <button onClick={confirmModal.requirePin ? verifyPinAndExecute : confirmModal.action} className={`flex-1 py-2 text-white rounded ${confirmModal.type==='success'?'bg-emerald-600':confirmModal.type==='danger'?'bg-rose-600':'bg-indigo-600'}`}>تأكيد</button>
                  </div>
              </div>
          </div>
      )}

      {/* System Bank Modal */}
      {showSystemBankModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="glass-card w-full max-w-md p-8 rounded-[2.5rem] bg-white dark:bg-indigo-950 shadow-2xl animate-in zoom-in duration-300">
                  <h3 className="text-lg font-black text-center text-indigo-600 mb-6">{systemBankForm.id ? 'تعديل حساب بنكي' : 'إضافة حساب بنكي جديد'}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 px-2">اسم البنك / المحفظة</label>
                          <input type="text" value={systemBankForm.bankName} onChange={e => setSystemBankForm({...systemBankForm, bankName: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none" placeholder="مثال: الكريمي" />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 px-2">رقم الحساب</label>
                          <input type="text" value={systemBankForm.accountNumber} onChange={e => setSystemBankForm({...systemBankForm, accountNumber: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none font-mono" placeholder="12345678" />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 px-2">اسم المستفيد</label>
                          <input type="text" value={systemBankForm.accountHolder} onChange={e => setSystemBankForm({...systemBankForm, accountHolder: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none" placeholder="الاسم الرباعي" />
                      </div>
                      <div className="flex gap-2 pt-4">
                          <button onClick={() => setShowSystemBankModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs">إلغاء</button>
                          <button onClick={handleSaveSystemBank} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg">حفظ</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* User Modal (Updated with Profit Percentage for Agents) */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4 shadow-2xl">
                <h3 className="font-bold text-center text-lg">{isEditMode ? 'تعديل بيانات' : 'مستخدم جديد'}</h3>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 px-1">الاسم الرباعي</label>
                    <input className="w-full p-3 border rounded-xl text-xs font-bold" placeholder="الاسم" value={userForm.fullName} onChange={e=>setUserForm({...userForm, fullName:e.target.value})} />
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 px-1">رقم الهاتف</label>
                    <input className="w-full p-3 border rounded-xl text-xs font-bold" placeholder="رقم الهاتف" value={userForm.phone} onChange={e=>setUserForm({...userForm, phone:e.target.value})} />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 px-1">البريد الإلكتروني (اختياري)</label>
                    <input className="w-full p-3 border rounded-xl text-xs font-bold" placeholder="البريد" value={userForm.email} onChange={e=>setUserForm({...userForm, email:e.target.value})} />
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 px-1">
                        {isEditMode ? 'تغيير كلمة المرور (اترك فارغاً للإبقاء)' : 'كلمة المرور الافتراضية'}
                    </label>
                    <input 
                        className="w-full p-3 border rounded-xl text-xs font-bold" 
                        type="password" 
                        placeholder={isEditMode ? "••••••" : "كلمة المرور"} 
                        value={userForm.password} 
                        onChange={e=>setUserForm({...userForm, password:e.target.value})} 
                    />
                </div>

                {userForm.role === UserRole.AGENT && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-indigo-600 px-1">اسم الشبكة</label>
                            <input className="w-full p-3 border rounded-xl text-xs font-bold" placeholder="اسم الشبكة" value={userForm.networkName} onChange={e=>setUserForm({...userForm, networkName:e.target.value})} />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-emerald-600 px-1">نسبة ربح النظام (%)</label>
                            <div className="relative">
                                <input type="number" min="0" max="100" className="w-full p-3 pl-8 border rounded-xl text-xs font-bold text-center" placeholder="مثال: 10" value={userForm.profitPercentage} onChange={e=>setUserForm({...userForm, profitPercentage:parseFloat(e.target.value)})} />
                                <span className="absolute left-3 top-3 text-xs font-bold opacity-50">%</span>
                            </div>
                            <p className="text-[9px] text-slate-400 px-1">يتم خصم هذه النسبة من كل كرت يبيعه الوكيل.</p>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 pt-2">
                    <button onClick={()=>setShowUserModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs hover:bg-slate-200">إلغاء</button>
                    <button onClick={handleSaveUser} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-lg">حفظ البيانات</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
