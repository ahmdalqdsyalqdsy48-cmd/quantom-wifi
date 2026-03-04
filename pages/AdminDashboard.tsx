
import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { User, UserRole, Status, PointRequest, SettlementReport, BankAccount, Card, CardStatus, Order, Agent, MikroTikConfig, SystemSettings, AgentVisibleTabs, TabConfig } from '../types';
import { cn } from '../lib/utils';
import { StorageService, SystemLog } from '../services/storage';
import { googleSheetsService } from '../src/services/GoogleSheetsService';
import * as Icons from 'lucide-react';
import { useNotification } from '../components/Layout';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
  const [activeSection, setActiveSection] = useState<'home' | 'requests' | 'agents' | 'managers' | 'finance' | 'banks' | 'reports' | 'monitoring' | 'settings'>('home');
  const [googleStats, setGoogleStats] = useState<Record<string, any> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [reportTab, setReportTab] = useState<'all' | 'sales' | 'shipping' | 'users' | 'agents_perf'>('sales');
  const [agentPerfSearch, setAgentPerfSearch] = useState('');
  const [debouncedAgentPerfSearch, setDebouncedAgentPerfSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAgentPerfSearch(agentPerfSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [agentPerfSearch]);

  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalSearch(globalSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);

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
  const [debouncedLogSearch, setDebouncedLogSearch] = useState('');
  
  // Debounce search input to prevent UI freezing during typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLogSearch(logSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [logSearch]);

  // Requests Filter
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAW'>('ALL');

  // Monitoring Filters
  const [monitoringSearch, setMonitoringSearch] = useState('');
  const [debouncedMonitoringSearch, setDebouncedMonitoringSearch] = useState('');
  const [monitoringStatusFilter, setMonitoringStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'INACTIVE'>('ALL');
  const [monitoringRoleFilter, setMonitoringRoleFilter] = useState<'ALL' | 'USER' | 'AGENT' | 'MANAGER'>('ALL');
  const [monitoringDateRange, setMonitoringDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMonitoringSearch(monitoringSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [monitoringSearch]);

  // Activity Filters (Home Page)
  const [activitySearch, setActivitySearch] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState<'ALL' | 'PURCHASE' | 'DEPOSIT' | 'SETTLEMENT' | 'LOGIN'>('ALL');
  const [activityTimeFilter, setActivityTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('DAY');
  const [activityCustomDate, setActivityCustomDate] = useState({ start: '', end: '' });
  const [activitiesLimit, setActivitiesLimit] = useState(50);

  // Report Filters
  const [reportTimeFilter, setReportTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('DAY');
  const [customReportDate, setCustomReportDate] = useState({ start: '', end: '' });

  // MikroTik Config State
  const [mikroTikConfig, setMikroTikConfig] = useState<MikroTikConfig>({ host: '', port: '8728', username: '', password: '', mode: 'MANUAL' });

  // --- Modals State ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ id: '', fullName: '', phone: '', email: '', password: '', role: UserRole.AGENT, networkName: '', profitPercentage: 0, isActive: true, pointsBalance: 0 });
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

    const savedMikroTik = localStorage.getItem('qw_mikrotik_config');
    if(savedMikroTik) setMikroTikConfig(JSON.parse(savedMikroTik));
  };

  useEffect(() => {
    refreshData();
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    
    // Fetch Google Sheets stats
    const fetchGoogleStats = async () => {
      const stats = await googleSheetsService.getStats();
      if (Object.keys(stats).length > 0) {
        setGoogleStats(stats);
      }
    };
    fetchGoogleStats();
  }, []);

  const handleNavigate = (section: typeof activeSection) => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      setActiveSection(section);
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

  const handleSaveUser = () => {
        if (!userForm.fullName || !userForm.phone || (!userForm.id && !userForm.password)) {
            showNotification('يرجى ملء كافة الحقول الأساسية (الاسم ورقم الهاتف)', 'error');
            return;
        }
        
        if (userForm.role === UserRole.AGENT && !userForm.networkName) {
            showNotification('اسم الشبكة مطلوب للوكلاء', 'error');
            return;
        }

        if (userForm.id) {
             // Update existing
             const updateData: any = { ...userForm };
             if (!userForm.password) delete updateData.password;
             
             StorageService.updateUser(userForm.id, updateData);
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
          phone: user.phone || '',
          email: user.email || '',
          password: '', // Password placeholder handled in modal
          role: user.role,
          networkName: user.role === UserRole.AGENT ? (user as Agent).networkName : '',
          profitPercentage: user.role === UserRole.AGENT ? (user as Agent).profitPercentage : 0,
          isActive: user.isActive,
          pointsBalance: user.pointsBalance || 0
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
                    <DetailBox label="رقم الهاتف" value={u.phone || 'غير متوفر'} icon="📱" color="bg-emerald-50 border-emerald-200 text-emerald-700" fullWidth />
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
            const userDeposits = pointRequests.filter(r => r.userId === u.id);
            
            const totalSpent = userOrders.reduce((acc, o) => acc + o.pointsUsed, 0);
            const totalDeposited = userDeposits.filter(r => r.status === Status.COMPLETED).reduce((acc, r) => acc + r.amount, 0);

            const handleExportUserLogs = (format: 'PDF' | 'CSV') => {
                const headers = ['التاريخ', 'النوع', 'التفاصيل', 'القيمة', 'الحالة'];
                const rows = [
                    ...userOrders.map(o => [new Date(o.createdAt).toLocaleString('ar-YE'), 'شراء', `كرت ${o.categoryName}`, `${o.pointsUsed} ن`, 'مكتمل']),
                    ...userDeposits.map(r => [new Date(r.createdAt).toLocaleString('ar-YE'), 'شحن', r.paymentMethod, `${r.amount} ن`, r.status]),
                    ...userLogins.map(l => [new Date(l.timestamp).toLocaleString('ar-YE'), 'دخول', 'تسجيل دخول', '-', 'ناجح'])
                ].sort((a, b) => new Date(b[0] as string).getTime() - new Date(a[0] as string).getTime());

                if (format === 'CSV') {
                    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `user_logs_${u.fullName}.csv`);
                    document.body.appendChild(link);
                    link.click();
                } else {
                    const doc = new jsPDF();
                    // Basic PDF generation without custom fonts for simplicity in this environment
                    doc.text(`User Activity Log: ${u.fullName}`, 10, 10);
                    (doc as any).autoTable({
                        head: [headers],
                        body: rows,
                        startY: 20,
                        styles: { halign: 'right' },
                        headStyles: { fillColor: [79, 70, 229] }
                    });
                    doc.save(`user_logs_${u.fullName}.pdf`);
                }
            };

            return (
                <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                            <p className="text-[10px] font-black text-indigo-600 uppercase">إجمالي المشتريات</p>
                            <p className="text-xl font-black">{userOrders.length}</p>
                        </div>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-[10px] font-black text-emerald-600 uppercase">إجمالي الإنفاق</p>
                            <p className="text-xl font-black">{totalSpent} ن</p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                            <p className="text-[10px] font-black text-blue-600 uppercase">إجمالي الشحن</p>
                            <p className="text-xl font-black">{totalDeposited} ن</p>
                        </div>
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                            <p className="text-[10px] font-black text-amber-600 uppercase">عدد الدخول</p>
                            <p className="text-xl font-black">{userLogins.length}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center border-b dark:border-white/10 pb-2">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">سجل النشاطات التفصيلي</h4>
                        <div className="flex gap-2">
                            <button onClick={() => handleExportUserLogs('CSV')} className="p-1.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 transition-all" title="تصدير CSV">
                                <Icons.FileText size={14} />
                            </button>
                            <button onClick={() => handleExportUserLogs('PDF')} className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 transition-all" title="تصدير PDF">
                                <Icons.FileDown size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10 custom-scrollbar no-scrollbar">
                        <table className="w-full text-right text-[10px] border-collapse">
                            <thead className="bg-slate-50 dark:bg-white/5 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3">التاريخ</th>
                                    <th className="p-3">النوع</th>
                                    <th className="p-3">التفاصيل</th>
                                    <th className="p-3">القيمة</th>
                                    <th className="p-3">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                {[
                                    ...userOrders.map(o => ({ id: o.id, date: o.createdAt, type: 'شراء', details: `كرت ${o.categoryName}`, val: `${o.pointsUsed} ن`, status: 'مكتمل', color: 'bg-cyan-100 text-cyan-700' })),
                                    ...userDeposits.map(r => ({ id: r.id, date: r.createdAt, type: 'شحن', details: r.paymentMethod, val: `${r.amount} ن`, status: r.status, color: r.status === Status.COMPLETED ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700' })),
                                    ...userLogins.map(l => ({ id: l.id, date: l.timestamp, type: 'دخول', details: 'تسجيل دخول', val: '-', status: 'ناجح', color: 'bg-indigo-100 text-indigo-700' }))
                                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                        <td className="p-3 font-mono opacity-60">{new Date(item.date).toLocaleString('ar-YE')}</td>
                                        <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${item.color}`}>{item.type}</span></td>
                                        <td className="p-3 font-bold">{item.details}</td>
                                        <td className="p-3 font-black text-indigo-600">{item.val}</td>
                                        <td className="p-3"><span className="opacity-60">{item.status}</span></td>
                                    </tr>
                                ))}
                                {userOrders.length === 0 && userDeposits.length === 0 && userLogins.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 italic">لا توجد نشاطات مسجلة</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
      
      // Optimize card counting
      let availableCards = 0;
      let soldCards = 0;
      const categoryCounts: Record<string, number> = {};
      
      allCards.forEach(c => {
        if (c.status === CardStatus.AVAILABLE) {
          availableCards++;
          categoryCounts[c.categoryId] = (categoryCounts[c.categoryId] || 0) + 1;
        } else if (c.status === CardStatus.SOLD) {
          soldCards++;
        }
      });

      const totalSalesPoints = orders.reduce((acc, o) => acc + o.pointsUsed, 0);
      const totalAgentEarnings = orders.reduce((acc, o) => acc + o.agentEarnings, 0);
      const totalSystemProfit = orders.reduce((acc, o) => acc + o.masterProfit, 0);

      const pendingPoints = pointRequests.filter(r => r.status === Status.PENDING).length;
      const pendingSettlements = settlements.filter(r => r.status === Status.PENDING).length;
      const acceptedReqs = pointRequests.filter(r => r.status === Status.COMPLETED).length + settlements.filter(r => r.status === Status.PAID).length;
      const rejectedReqs = pointRequests.filter(r => r.status === Status.REJECTED).length + settlements.filter(r => r.status === Status.REJECTED).length;

      // Low Stock Logic optimized
      const lowStockItems = categories.filter(c => {
          const count = categoryCounts[c.id] || 0;
          return count < 5;
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
          // Priority to Google Sheets stats if available for certain keys
          const googleKeyMap: Record<string, string> = {
            users: 'users_active',
            agents: 'agents_active',
            managers: 'managers_active',
            networks: 'networks_count',
            cats: 'categories_count',
            avail: 'available_cards',
            sold: 'sold_cards',
            sales: 'total_sales_points',
            earnings: 'agent_earnings',
            profit: 'system_profit',
            finops: 'financial_operations',
            pend_p: 'pending_deposits',
            pend_s: 'pending_settlements',
            appr: 'approved_requests',
            rej: 'rejected_requests'
          };

          let finalVal = val;
          if (googleStats && googleKeyMap[key] && googleStats[googleKeyMap[key]]) {
            const gVal = googleStats[googleKeyMap[key]];
            if (key === 'users' || key === 'agents' || key === 'managers') {
               // Handle the "active / total" format
               const totalKey = googleKeyMap[key].replace('_active', '_total');
               if (googleStats[totalKey]) {
                 finalVal = `${gVal} / ${googleStats[totalKey]}`;
               } else {
                 finalVal = gVal;
               }
            } else {
              finalVal = isNaN(Number(gVal)) ? gVal : Number(gVal);
            }
          }

          if (typeof finalVal === 'string') return finalVal; 
          const offset = statOffsets[key] || 0;
          return Math.max(0, (finalVal as number) - offset);
      };

      const formatVal = (v: any, isCurrency = false) => {
          if (typeof v === 'string') return v;
          if (typeof v === 'number') {
              return isCurrency ? v.toFixed(1) : v.toLocaleString();
          }
          return v || '0';
      };

      return {
          metrics: [
              { key: 'users', title: 'المستخدمين (نشط/كلي)', value: formatVal(getVal('users', raw.users)), raw: raw.users, icon: '👥', color: 'indigo' },
              { key: 'agents', title: 'الوكلاء (نشط/كلي)', value: formatVal(getVal('agents', raw.agents)), raw: raw.agents, icon: '📡', color: 'violet' },
              { key: 'managers', title: 'المدراء (نشط/كلي)', value: formatVal(getVal('managers', raw.managers)), raw: raw.managers, icon: '👔', color: 'purple' },
              { key: 'networks', title: 'عدد الشبكات', value: formatVal(getVal('networks', raw.networks)), raw: raw.networks, icon: '🌐', color: 'sky' },
              { key: 'cats', title: 'عدد الفئات', value: formatVal(getVal('cats', raw.cats)), raw: raw.cats, icon: '🏷️', color: 'slate' },
              { key: 'avail', title: 'كروت متاحة', value: formatVal(getVal('avail', raw.avail)), raw: raw.avail, icon: '🎫', color: 'emerald' },
              { key: 'sold', title: 'كروت مباعة', value: formatVal(getVal('sold', raw.sold)), raw: raw.sold, icon: '📤', color: 'amber' },
              { key: 'sales', title: 'إجمالي المبيعات (ن)', value: formatVal(getVal('sales', raw.sales)), raw: raw.sales, icon: '💎', color: 'cyan' },
              { key: 'earnings', title: 'أرباح الوكلاء', value: formatVal(getVal('earnings', raw.earnings), true), raw: raw.earnings, icon: '💰', color: 'teal' },
              { key: 'profit', title: 'أرباح النظام', value: formatVal(getVal('profit', raw.profit), true), raw: raw.profit, icon: '📈', color: 'green' },
              { key: 'finops', title: 'العمليات المالية', value: formatVal(getVal('finops', raw.finops)), raw: raw.finops, icon: '🏦', color: 'gray' },
              { key: 'pend_p', title: 'شحن معلق', value: formatVal(getVal('pend_p', raw.pend_p)), raw: raw.pend_p, icon: '⏳', color: 'orange' },
              { key: 'pend_s', title: 'تسويات معلقة', value: formatVal(getVal('pend_s', raw.pend_s)), raw: raw.pend_s, icon: '⚖️', color: 'rose' },
              { key: 'appr', title: 'طلبات مقبولة', value: formatVal(getVal('appr', raw.appr)), raw: raw.appr, icon: '✅', color: 'blue' },
              { key: 'rej', title: 'طلبات مرفوضة', value: formatVal(getVal('rej', raw.rej)), raw: raw.rej, icon: '❌', color: 'pink' },
          ],
          notifications: {
              pending: raw.pend_p + raw.pend_s,
              lowStock: lowStockItems
          }
      };
  }, [users, allCards, orders, pointRequests, settlements, categories, statOffsets]);

  // --- Reports Logic ---
  const reportData = useMemo(() => {
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

      const sales = orders.filter(o => isWithinRange(o.createdAt));
      const shipping = pointRequests.filter(r => isWithinRange(r.createdAt));
      const newUsers = users.filter(u => u.role === UserRole.USER && isWithinRange(u.createdAt));
      const agentsPerf = users.filter(u => {
          if (u.role !== UserRole.AGENT) return false;
          if (debouncedAgentPerfSearch) {
              const s = debouncedAgentPerfSearch.toLowerCase();
              const agent = u as Agent;
              return u.fullName.toLowerCase().includes(s) || 
                     (agent.networkName || '').toLowerCase().includes(s);
          }
          return true;
      });

      return { sales, shipping, newUsers, agentsPerf };
  }, [orders, pointRequests, users, reportTimeFilter, customReportDate, debouncedAgentPerfSearch]);

  const filteredReportData = useMemo(() => {
      let filtered: any[] = [];
      if (reportTab === 'sales') filtered = reportData.sales;
      else if (reportTab === 'shipping') filtered = reportData.shipping;
      else if (reportTab === 'users') filtered = reportData.newUsers;
      else if (reportTab === 'agents_perf') filtered = reportData.agentsPerf;
      else if (reportTab === 'all') filtered = []; 

      if (debouncedGlobalSearch) {
        const s = debouncedGlobalSearch.toLowerCase();
        filtered = filtered.filter(item => {
          const name = item.fullName || item.userName || item.networkName || '';
          const id = item.id || '';
          const details = item.details || item.categoryName || '';
          return name.toLowerCase().includes(s) || 
                 id.toLowerCase().includes(s) || 
                 details.toLowerCase().includes(s);
        });
      }

      return filtered;
  }, [reportData, reportTab, debouncedGlobalSearch]);

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

      if (debouncedGlobalSearch) {
        const s = debouncedGlobalSearch.toLowerCase();
        combined = combined.filter(r => {
          const name = 'agentName' in r ? r.agentName : r.userName;
          return name.toLowerCase().includes(s) || 
                 r.id.toLowerCase().includes(s) || 
                 (r as any).paymentMethod?.toLowerCase().includes(s) ||
                 (r as any).referenceNumber?.toLowerCase().includes(s);
        });
      }

      return combined;
  }, [pointRequests, settlements, requestFilter, debouncedGlobalSearch]);

  // --- Activity Log Data (Optimized) ---
  const activityLog = useMemo(() => {
    const logs: any[] = [];
    
    orders.forEach(o => {
      logs.push({
        id: o.id,
        user: o.userName,
        details: `شراء كرت ${o.categoryName}`,
        value: `${o.pointsUsed} ن`,
        timestamp: o.createdAt,
        type: 'PURCHASE',
        status: 'COMPLETED',
        source: o.networkName
      });
    });
    
    pointRequests.forEach(r => {
      logs.push({
        id: r.id,
        user: r.userName,
        details: `طلب شحن رصيد (${r.paymentMethod})`,
        value: `${r.amount} ن`,
        timestamp: r.createdAt,
        type: 'DEPOSIT',
        status: r.status,
        source: r.paymentMethod
      });
    });
    
    settlements.forEach(s => {
      logs.push({
        id: s.id,
        user: s.agentName,
        details: `طلب تسوية أرباح`,
        value: `${s.agentEarnings} ن`,
        timestamp: s.createdAt,
        type: 'SETTLEMENT',
        status: s.status,
        source: s.networkName
      });
    });

    systemLogs.filter(l => l.action === 'تسجيل دخول').forEach(l => {
        logs.push({
            id: l.id,
            user: l.performedBy,
            details: 'تسجيل دخول للنظام',
            value: '-',
            timestamp: l.timestamp,
            type: 'LOGIN',
            status: 'SUCCESS',
            source: 'Web'
        });
    });
    
    let filtered = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply filters
    if (activityTypeFilter !== 'ALL') {
        filtered = filtered.filter(l => l.type === activityTypeFilter);
    }

    if (activitySearch) {
        const s = activitySearch.toLowerCase();
        filtered = filtered.filter(l => 
            l.user.toLowerCase().includes(s) || 
            l.details.toLowerCase().includes(s) || 
            l.source.toLowerCase().includes(s)
        );
    }

    // Time Filter
    const now = new Date();
    filtered = filtered.filter(l => {
        const d = new Date(l.timestamp);
        if (activityTimeFilter === 'DAY') return d.toDateString() === now.toDateString();
        if (activityTimeFilter === 'WEEK') { const ago = new Date(); ago.setDate(now.getDate() - 7); return d >= ago; }
        if (activityTimeFilter === 'MONTH') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (activityTimeFilter === 'CUSTOM' && activityCustomDate.start && activityCustomDate.end) {
            const s = new Date(activityCustomDate.start); const e = new Date(activityCustomDate.end); e.setHours(23, 59, 59);
            return d >= s && d <= e;
        }
        return true;
    });

    return filtered.map(l => ({
        ...l,
        formattedTime: new Date(l.timestamp).toLocaleString('ar-YE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    }));
  }, [orders, pointRequests, settlements, systemLogs, activityTypeFilter, activitySearch, activityTimeFilter, activityCustomDate]);

  const menuItems = [
    { id: 'home', label: 'الرئيسية', icon: '🏠' },
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
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-75 text-xs ${activeSection === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                  </button>
              ))}
          </nav>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'mr-64' : 'mr-0'} p-2 max-w-full`}>
          
          <div className="lg:hidden flex justify-between items-center mb-6">
              <h1 className="font-black text-lg">لوحة التحكم</h1>
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-white rounded-lg shadow text-indigo-600">☰</button>
          </div>

          {/* Global Search Bar */}
          <div className="mb-6 relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <Icons.Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input 
                  type="text" 
                  placeholder="بحث شامل في النظام (مستخدمين، طلبات، شبكات...)" 
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-4 pr-12 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
              {globalSearch && (
                  <button 
                      onClick={() => setGlobalSearch('')}
                      className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 hover:text-rose-500"
                  >
                      <Icons.X size={18} />
                  </button>
              )}
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

                  {/* Enhanced Recent Activities Table */}
                  <div className="glass-card rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                      <div className="p-6 bg-white dark:bg-white/5 border-b dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl">📋</div>
                              <div>
                                  <h3 className="font-black text-sm text-slate-800 dark:text-slate-200">آخر النشاطات والعمليات</h3>
                                  <p className="text-[10px] text-slate-400 font-bold">متابعة حية لكافة تحركات النظام</p>
                              </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                              <div className="relative group">
                                  <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                  <input 
                                      type="text" 
                                      placeholder="بحث..." 
                                      value={activitySearch}
                                      onChange={(e) => setActivitySearch(e.target.value)}
                                      className="pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 w-40"
                                  />
                              </div>
                              <select 
                                  value={activityTypeFilter}
                                  onChange={(e) => setActivityTypeFilter(e.target.value as any)}
                                  className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-bold outline-none"
                              >
                                  <option value="ALL">كل العمليات</option>
                                  <option value="PURCHASE">مشتريات</option>
                                  <option value="DEPOSIT">شحن</option>
                                  <option value="SETTLEMENT">تسويات</option>
                                  <option value="LOGIN">دخول</option>
                              </select>
                              <select 
                                  value={activityTimeFilter}
                                  onChange={(e) => setActivityTimeFilter(e.target.value as any)}
                                  className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-bold outline-none"
                              >
                                  <option value="DAY">اليوم</option>
                                  <option value="WEEK">هذا الأسبوع</option>
                                  <option value="MONTH">هذا الشهر</option>
                                  <option value="CUSTOM">مخصص</option>
                              </select>
                              <button 
                                  onClick={() => {
                                      const headers = ['الوقت', 'المستخدم', 'النوع', 'التفاصيل', 'القيمة', 'الحالة', 'المصدر'];
                                      const rows = activityLog.slice(0, activitiesLimit).map(l => [
                                          l.formattedTime,
                                          l.user,
                                          l.type,
                                          l.details,
                                          l.value,
                                          l.status,
                                          l.source
                                      ]);
                                      const csvContent = "data:text/csv;charset=utf-8," 
                                          + headers.join(",") + "\n" 
                                          + rows.map(e => e.join(",")).join("\n");
                                      const encodedUri = encodeURI(csvContent);
                                      const link = document.createElement("a");
                                      link.setAttribute("href", encodedUri);
                                      link.setAttribute("download", `activities_${new Date().toISOString()}.csv`);
                                      document.body.appendChild(link);
                                      link.click();
                                  }}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                                  title="تصدير CSV"
                              >
                                  <Icons.Download size={16} />
                              </button>
                          </div>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-right text-[10px] border-collapse">
                              <thead className="bg-slate-50 dark:bg-white/5 border-b dark:border-white/10 text-slate-500 font-black uppercase tracking-widest">
                                  <tr>
                                      <th className="px-3 py-2">الوقت</th>
                                      <th className="px-3 py-2">المستخدم</th>
                                      <th className="px-3 py-2">النوع</th>
                                      <th className="px-3 py-2">التفاصيل</th>
                                      <th className="px-3 py-2 text-center">القيمة</th>
                                      <th className="px-3 py-2 text-center">الحالة</th>
                                      <th className="px-3 py-2 text-center">المصدر</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                                  {activityLog.slice(0, activitiesLimit).map((act) => (
                                      <tr key={act.id} className="hover:bg-indigo-50/30 dark:hover:bg-white/5 transition-colors group">
                                          <td className="px-3 py-2 text-slate-400 font-mono" dir="ltr">{act.formattedTime}</td>
                                          <td className="px-3 py-2">
                                              <div className="flex items-center gap-2">
                                                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">👤</div>
                                                  <span className="text-slate-800 dark:text-slate-200">{act.user}</span>
                                              </div>
                                          </td>
                                          <td className="px-3 py-2">
                                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${
                                                  act.type === 'PURCHASE' ? 'bg-cyan-50 text-cyan-600' : 
                                                  act.type === 'DEPOSIT' ? 'bg-emerald-50 text-emerald-600' : 
                                                  act.type === 'SETTLEMENT' ? 'bg-amber-50 text-amber-600' : 
                                                  act.type === 'LOGIN' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100'
                                              }`}>
                                                  {act.type === 'PURCHASE' ? 'مشتريات' : 
                                                   act.type === 'DEPOSIT' ? 'شحن' : 
                                                   act.type === 'SETTLEMENT' ? 'تسوية' : 
                                                   act.type === 'LOGIN' ? 'دخول' : act.type}
                                              </span>
                                          </td>
                                          <td className="px-3 py-2 text-slate-500">{act.details}</td>
                                          <td className="px-3 py-2 text-center font-black text-indigo-600">{act.value}</td>
                                          <td className="px-3 py-2 text-center">
                                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${
                                                  act.status === 'COMPLETED' || act.status === 'PAID' || act.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 
                                                  act.status === 'PENDING' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                              }`}>
                                                  {act.status}
                                              </span>
                                          </td>
                                          <td className="px-3 py-2 text-center text-slate-400">{act.source}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                      {activityLog.length > activitiesLimit && (
                          <div className="p-4 text-center border-t dark:border-white/10">
                              <button 
                                  onClick={() => setActivitiesLimit(prev => prev + 50)}
                                  className="px-8 py-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                              >
                                  عرض المزيد من النشاطات ⬇️
                              </button>
                          </div>
                      )}
                      {activityLog.length === 0 && (
                          <div className="p-12 text-center text-slate-400 italic">
                              لا توجد نشاطات مسجلة حالياً
                          </div>
                      )}
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
                                  <tr><th className="px-3 py-2">الاسم</th><th className="px-3 py-2">النوع</th><th className="px-3 py-2">القيمة</th><th className="px-3 py-2">التفاصيل / البنك</th><th className="px-3 py-2">التاريخ</th><th className="px-3 py-2">الحالة</th><th className="px-3 py-2 text-center">تحكم</th></tr>
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
                                              <td className="px-3 py-2">{name}</td>
                                              <td className="px-3 py-2"><span className={`px-2 py-1 rounded text-[10px] ${isSettlement ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{isSettlement ? 'تسوية وكيل' : 'شحن مستخدم'}</span></td>
                                              <td className="px-3 py-2 font-black">{val}</td>
                                              <td className="px-3 py-2 text-[10px] opacity-70">{details} <br/> <span className="font-mono">{ref}</span></td>
                                              <td className="px-3 py-2 text-[10px] opacity-50" dir="ltr">{new Date(item.createdAt).toLocaleDateString()}</td>
                                              <td className="px-3 py-2"><span className={`px-2 py-1 rounded text-[10px] ${item.status === Status.PENDING ? 'bg-blue-100 text-blue-600' : item.status === Status.COMPLETED || item.status === Status.PAID ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{item.status}</span></td>
                                              <td className="px-3 py-2">
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
                  
                  {/* Report Tabs & Type Dropdown */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                          <button onClick={() => setReportTab('all')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='all'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>الكل</button>
                          <button onClick={() => setReportTab('sales')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='sales'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>كشف المبيعات</button>
                          <button onClick={() => setReportTab('shipping')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='shipping'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>تقارير الشحن</button>
                          <button onClick={() => setReportTab('users')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='users'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>المستخدمين الجدد</button>
                          <button onClick={() => setReportTab('agents_perf')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all whitespace-nowrap ${reportTab==='agents_perf'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-500'}`}>أداء الوكلاء 📡</button>
                      </div>
                      
                      <div className="w-full sm:w-64">
                          <select 
                            value={reportTab} 
                            onChange={(e) => setReportTab(e.target.value as any)}
                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none focus:border-indigo-500"
                          >
                            <option value="all">الكل</option>
                            <option value="sales">كشف المبيعات</option>
                            <option value="shipping">تقارير الشحن</option>
                            <option value="users">المستخدمين الجدد</option>
                            <option value="agents_perf">أداء الوكلاء</option>
                          </select>
                      </div>
                  </div>

                  {/* Time Filter (Common for Sales/Shipping) */}
                  {(reportTab === 'all' || reportTab === 'sales' || reportTab === 'shipping') && (
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
                  <div id="report-content" className="glass-card p-6 rounded-[2rem] border min-h-[400px] bg-white dark:bg-slate-900 overflow-hidden space-y-12">
                      {(reportTab === 'all' || reportTab === 'sales') && (
                          <div className="space-y-6">
                              {reportTab === 'all' && <h3 className="font-black text-lg border-b pb-2">📊 كشف المبيعات</h3>}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                  <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl border border-cyan-100 dark:border-cyan-900/30">
                                      <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">إجمالي المبيعات</p>
                                      <p className="text-2xl font-black">{reportData.sales.reduce((acc, o) => acc + (o as Order).pointsUsed, 0).toLocaleString()} ن</p>
                                  </div>
                                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">أرباح النظام</p>
                                      <p className="text-2xl font-black">{reportData.sales.reduce((acc, o) => acc + (o as Order).masterProfit, 0).toFixed(2)} ن</p>
                                  </div>
                                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">عمولات الوكلاء</p>
                                      <p className="text-2xl font-black">{reportData.sales.reduce((acc, o) => acc + (o as Order).agentEarnings, 0).toFixed(2)} ن</p>
                                  </div>
                              </div>

                              <div className="overflow-x-auto rounded-xl border dark:border-white/5">
                                  <table className="w-full text-right text-[11px] min-w-[800px]">
                                      <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-500">
                                          <tr>
                                              <th className="px-4 py-3">التاريخ</th>
                                              <th className="px-4 py-3">العميل</th>
                                              <th className="px-4 py-3">الشبكة</th>
                                              <th className="px-4 py-3">الفئة</th>
                                              <th className="px-4 py-3">المبلغ</th>
                                              <th className="px-4 py-3">ربح النظام</th>
                                              <th className="px-4 py-3">عمولة الوكيل</th>
                                              <th className="px-4 py-3">الحالة</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y dark:divide-white/5">
                                          {reportData.sales.map((o: Order) => (
                                              <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                                  <td className="px-4 py-3 font-mono opacity-60">{new Date(o.createdAt).toLocaleString('ar-YE')}</td>
                                                  <td className="px-4 py-3 font-bold">{o.userName}</td>
                                                  <td className="px-4 py-3">{o.networkName}</td>
                                                  <td className="px-4 py-3">{o.categoryName}</td>
                                                  <td className="px-4 py-3 font-black text-indigo-600">{o.pointsUsed} ن</td>
                                                  <td className="px-4 py-3 font-bold text-emerald-600">{o.masterProfit.toFixed(2)} ن</td>
                                                  <td className="px-4 py-3 font-bold text-amber-600">{o.agentEarnings.toFixed(2)} ن</td>
                                                  <td className="px-4 py-3"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black">مكتمل</span></td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}

                      {(reportTab === 'all' || reportTab === 'shipping') && (
                          <div className="space-y-6">
                              {reportTab === 'all' && <h3 className="font-black text-lg border-b pb-2">💳 تقارير الشحن</h3>}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">إجمالي الشحن المقبول</p>
                                      <p className="text-2xl font-black">{reportData.shipping.filter(r => r.status === Status.COMPLETED).reduce((acc, r) => acc + (r as PointRequest).amount, 0).toLocaleString()} ن</p>
                                  </div>
                                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">طلبات قيد الانتظار</p>
                                      <p className="text-2xl font-black">{reportData.shipping.filter(r => r.status === Status.PENDING).length} طلب</p>
                                  </div>
                              </div>

                              <div className="overflow-x-auto rounded-xl border dark:border-white/5">
                                  <table className="w-full text-right text-[11px] min-w-[800px]">
                                      <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-500">
                                          <tr>
                                              <th className="px-4 py-3">التاريخ</th>
                                              <th className="px-4 py-3">المستخدم</th>
                                              <th className="px-4 py-3">المبلغ</th>
                                              <th className="px-4 py-3">الطريقة</th>
                                              <th className="px-4 py-3">المرجع</th>
                                              <th className="px-4 py-3">الحالة</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y dark:divide-white/5">
                                          {reportData.shipping.map((r: PointRequest) => (
                                              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                                  <td className="px-4 py-3 font-mono opacity-60">{new Date(r.createdAt).toLocaleString('ar-YE')}</td>
                                                  <td className="px-4 py-3 font-bold">{r.userName}</td>
                                                  <td className="px-4 py-3 font-black text-indigo-600">{r.amount} ن</td>
                                                  <td className="px-4 py-3">{r.paymentMethod}</td>
                                                  <td className="px-4 py-3 font-mono">{r.referenceNumber}</td>
                                                  <td className="px-4 py-3">
                                                      <span className={cn("px-2 py-1 rounded-full text-[9px] font-black", 
                                                          r.status === Status.COMPLETED ? "bg-emerald-100 text-emerald-700" : 
                                                          r.status === Status.PENDING ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700")}>
                                                          {r.status}
                                                      </span>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}

                      {(reportTab === 'all' || reportTab === 'users') && (
                          <div className="space-y-6">
                              {reportTab === 'all' && <h3 className="font-black text-lg border-b pb-2">👥 المستخدمين الجدد</h3>}
                              <div className="overflow-x-auto rounded-xl border dark:border-white/5">
                                  <table className="w-full text-right text-[11px] min-w-[800px]">
                                      <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-500">
                                          <tr>
                                              <th className="px-4 py-3">تاريخ التسجيل</th>
                                              <th className="px-4 py-3">الاسم</th>
                                              <th className="px-4 py-3">الهاتف</th>
                                              <th className="px-4 py-3">الرصيد</th>
                                              <th className="px-4 py-3">الحالة</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y dark:divide-white/5">
                                          {reportData.newUsers.map((u: User) => (
                                              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                                  <td className="px-4 py-3 font-mono opacity-60">{new Date(u.createdAt).toLocaleDateString('ar-YE')}</td>
                                                  <td className="px-4 py-3 font-bold">{u.fullName}</td>
                                                  <td className="px-4 py-3">{u.phone}</td>
                                                  <td className="px-4 py-3 font-black text-indigo-600">{u.pointsBalance} ن</td>
                                                  <td className="px-4 py-3">
                                                      <span className={cn("px-2 py-1 rounded-full text-[9px] font-black", 
                                                          u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                                          {u.isActive ? 'نشط' : 'موقف'}
                                                      </span>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}

                      {(reportTab === 'all' || reportTab === 'agents_perf') && (
                          <div className="space-y-6">
                              {(reportTab === 'all' || reportTab === 'agents_perf') && (
                                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                      {reportTab === 'all' && <h3 className="font-black text-lg border-b pb-2 flex-1">📡 أداء الوكلاء</h3>}
                                      <div className="relative w-full sm:w-64">
                                          <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                          <input 
                                              type="text" 
                                              placeholder="بحث باسم الوكيل أو الشبكة..." 
                                              value={agentPerfSearch}
                                              onChange={(e) => setAgentPerfSearch(e.target.value)}
                                              className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-500"
                                          />
                                      </div>
                                  </div>
                              )}
                              <div className="overflow-x-auto rounded-xl border dark:border-white/5">
                                  <table className="w-full text-right text-[11px] min-w-[800px]">
                                      <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-500">
                                          <tr>
                                              <th className="px-4 py-3">الوكيل</th>
                                              <th className="px-4 py-3">الشبكة</th>
                                              <th className="px-4 py-3">إجمالي المبيعات</th>
                                              <th className="px-4 py-3">أرباح الوكيل</th>
                                              <th className="px-4 py-3">أرباح النظام</th>
                                              <th className="px-4 py-3">الحالة</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y dark:divide-white/5">
                                          {reportData.agentsPerf.map((u: User) => {
                                              const agent = u as Agent;
                                              const agentOrders = orders.filter(o => o.agentId === u.id);
                                              const totalSales = agentOrders.reduce((acc, o) => acc + o.pointsUsed, 0);
                                              const totalEarnings = agentOrders.reduce((acc, o) => acc + o.agentEarnings, 0);
                                              const totalProfit = agentOrders.reduce((acc, o) => acc + o.masterProfit, 0);
                                              
                                              return (
                                                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                                      <td className="px-4 py-3 font-bold">{u.fullName}</td>
                                                      <td className="px-4 py-3">{agent.networkName}</td>
                                                      <td className="px-4 py-3 font-black text-indigo-600">{totalSales.toLocaleString()} ن</td>
                                                      <td className="px-4 py-3 font-bold text-amber-600">{totalEarnings.toFixed(2)} ن</td>
                                                      <td className="px-4 py-3 font-bold text-emerald-600">{totalProfit.toFixed(2)} ن</td>
                                                      <td className="px-4 py-3">
                                                          <span className={cn("px-2 py-1 rounded-full text-[9px] font-black", 
                                                              u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                                              {u.isActive ? 'نشط' : 'موقف'}
                                                          </span>
                                                      </td>
                                                  </tr>
                                              );
                                          })}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}
          
          {/* USER MONITORING SECTION */}
          {activeSection === 'monitoring' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <SectionHeader title="مراقبة المستخدمين والنشاط" subtitle="متابعة عمليات الدخول، المشتريات، وإدارة الحظر" />
                  
                  {/* Quick Stats Indicators */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/5 flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl">👥</div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي المستخدمين</p>
                              <p className="text-xl font-black">{users.filter(u => u.role === UserRole.USER).length}</p>
                          </div>
                      </div>
                      <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/5 flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl">✅</div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase">المستخدمين النشطين</p>
                              <p className="text-xl font-black">{users.filter(u => u.role === UserRole.USER && u.isActive).length}</p>
                          </div>
                      </div>
                      <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/5 flex items-center gap-4">
                          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center text-xl">🚫</div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase">المستخدمين المحظورين</p>
                              <p className="text-xl font-black">{users.filter(u => u.role === UserRole.USER && !u.isActive).length}</p>
                          </div>
                      </div>
                  </div>

                  {/* Advanced Filters & Search */}
                  <div className="glass-card p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 space-y-4">
                      <div className="flex flex-col lg:flex-row gap-4">
                          <div className="relative flex-1 group">
                              <Icons.Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                              <input 
                                  type="text" 
                                  placeholder="بحث بالاسم، رقم الهاتف، أو البريد الإلكتروني..." 
                                  value={monitoringSearch}
                                  onChange={(e) => setMonitoringSearch(e.target.value)}
                                  className="w-full pr-12 pl-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm transition-all"
                              />
                          </div>
                          <div className="flex flex-wrap gap-2">
                              <select 
                                  value={monitoringRoleFilter}
                                  onChange={(e) => setMonitoringRoleFilter(e.target.value as any)}
                                  className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-[10px] outline-none focus:border-indigo-500"
                              >
                                  <option value="ALL">كل الأدوار</option>
                                  <option value="USER">مستخدم</option>
                                  <option value="AGENT">وكيل</option>
                                  <option value="MANAGER">مدير</option>
                              </select>
                              <select 
                                  value={monitoringStatusFilter}
                                  onChange={(e) => setMonitoringStatusFilter(e.target.value as any)}
                                  className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-[10px] outline-none focus:border-indigo-500"
                              >
                                  <option value="ALL">كل الحالات</option>
                                  <option value="ACTIVE">نشط</option>
                                  <option value="BLOCKED">محظور</option>
                              </select>
                              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-1">
                                  <span className="text-[9px] font-black text-slate-400">من:</span>
                                  <input type="date" value={monitoringDateRange.start} onChange={e => setMonitoringDateRange({...monitoringDateRange, start: e.target.value})} className="bg-transparent text-[10px] font-bold outline-none" />
                                  <span className="text-[9px] font-black text-slate-400">إلى:</span>
                                  <input type="date" value={monitoringDateRange.end} onChange={e => setMonitoringDateRange({...monitoringDateRange, end: e.target.value})} className="bg-transparent text-[10px] font-bold outline-none" />
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Users Table */}
                  <div className="glass-card rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                          <table className="w-full text-right">
                              <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  <tr>
                                      <th className="px-3 py-2">المستخدم</th>
                                      <th className="px-3 py-2">رقم الهاتف / البريد</th>
                                      <th className="px-3 py-2">الرصيد</th>
                                      <th className="px-3 py-2">الحالة</th>
                                      <th className="px-3 py-2">آخر ظهور</th>
                                      <th className="px-3 py-2 text-center">إجراءات</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                  {users.filter(u => {
                                      // Role Filter
                                      if (monitoringRoleFilter !== 'ALL' && u.role !== monitoringRoleFilter) return false;
                                      
                                      // Status Filter
                                      if (monitoringStatusFilter === 'ACTIVE' && !u.isActive) return false;
                                      if (monitoringStatusFilter === 'BLOCKED' && u.isActive) return false;

                                      // Search Filter
                                      if (debouncedMonitoringSearch) {
                                          const s = debouncedMonitoringSearch.toLowerCase();
                                          return u.fullName.toLowerCase().includes(s) || 
                                                 u.phone.includes(s) || 
                                                 (u.email && u.email.toLowerCase().includes(s));
                                      }

                                      // Date Filter (Registration Date - assuming createdAt exists on user)
                                      if (monitoringDateRange.start || monitoringDateRange.end) {
                                          const regDate = u.createdAt ? new Date(u.createdAt) : new Date();
                                          if (monitoringDateRange.start && regDate < new Date(monitoringDateRange.start)) return false;
                                          if (monitoringDateRange.end && regDate > new Date(monitoringDateRange.end)) return false;
                                      }

                                      return true;
                                  }).map(user => {
                                      const userLogins = systemLogs.filter(l => l.performedBy === user.fullName && l.action === 'تسجيل دخول');
                                      const lastLogin = userLogins.length > 0 ? userLogins[0] : null;
                                      
                                      return (
                                          <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                              <td className="px-6 py-4">
                                                  <div className="flex items-center gap-3">
                                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                          {user.isActive ? '👤' : '🚫'}
                                                      </div>
                                                      <div>
                                                          <p className="font-black text-xs text-slate-800 dark:text-white">{user.fullName}</p>
                                                          <p className="text-[9px] font-bold text-slate-400">{user.role === UserRole.USER ? 'مستخدم' : user.role === UserRole.AGENT ? 'وكيل' : 'مدير'}</p>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td className="px-6 py-4">
                                                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{user.phone}</p>
                                                  {user.email && <p className="text-[9px] text-slate-400">{user.email}</p>}
                                              </td>
                                              <td className="px-6 py-4">
                                                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                                      {user.pointsBalance.toLocaleString()} ن
                                                  </span>
                                              </td>
                                              <td className="px-6 py-4">
                                                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                      {user.isActive ? 'نشط' : 'محظور'}
                                                  </span>
                                              </td>
                                              <td className="px-6 py-4">
                                                  <p className="text-[9px] font-bold text-slate-500">
                                                      {lastLogin ? new Date(lastLogin.timestamp).toLocaleString('ar-YE') : 'لا يوجد سجل'}
                                                  </p>
                                              </td>
                                              <td className="px-6 py-4">
                                                  <div className="flex items-center justify-center gap-2">
                                                      <button 
                                                          onClick={() => handleEditUser(user)}
                                                          className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                                                          title="تعديل"
                                                      >
                                                          <Icons.Edit2 size={14} />
                                                      </button>
                                                      <button 
                                                          onClick={() => handleToggleAgent(user)}
                                                          className={`p-2 rounded-lg transition-all ${user.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                                                          title={user.isActive ? 'حظر' : 'إلغاء الحظر'}
                                                      >
                                                          {user.isActive ? <Icons.UserX size={14} /> : <Icons.UserCheck size={14} />}
                                                      </button>
                                                      <button 
                                                          onClick={() => setViewModal({ isOpen: true, title: `سجل نشاط: ${user.fullName}`, data: user, type: 'مراقبة_مستخدم' })}
                                                          className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all"
                                                          title="سجل النشاط"
                                                      >
                                                          <Icons.Activity size={14} />
                                                      </button>
                                                      <button 
                                                          onClick={() => handleDeleteUser(user)}
                                                          className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all"
                                                          title="حذف"
                                                      >
                                                          <Icons.Trash2 size={14} />
                                                      </button>
                                                  </div>
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                      {users.length === 0 && (
                          <div className="p-20 text-center">
                              <div className="text-6xl mb-4">👥</div>
                              <p className="text-slate-400 font-black text-lg">لا يوجد مستخدمين يطابقون الفلترة الحالية</p>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* UPDATED AGENTS SECTION: Card Layout with Circular Buttons */}
          {activeSection === 'agents' && (
              <div className="space-y-6">
                  <SectionHeader title="الوكلاء والشبكات" action={<button onClick={() => { setUserForm({ id: '', fullName: '', phone: '', password: '', role: UserRole.AGENT, networkName: '', profitPercentage: 10, isActive: true }); setIsEditMode(false); setShowUserModal(true); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs">+ وكيل جديد</button>} />
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
                                          <span className="text-[9px] bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md text-slate-500">{u.phone}</span>
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
                  <SectionHeader title="المدراء والمشرفين" subtitle="إدارة صلاحيات الوصول الإداري للنظام" action={<button onClick={() => { setUserForm({ id: '', fullName: '', phone: '', password: '', role: UserRole.MANAGER, networkName: '', profitPercentage: 0, isActive: true }); setIsEditMode(false); setShowUserModal(true); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs">+ مدير جديد</button>} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {users.filter(u => u.role === UserRole.MANAGER).map(u => (
                          <div key={u.id} className="glass-card p-6 rounded-[2rem] border relative overflow-hidden group">
                              <div className="absolute top-0 left-0 p-4 opacity-10 text-6xl group-hover:scale-110 transition-transform">👔</div>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <h3 className="font-black text-lg">{u.fullName}</h3>
                                      <p className="text-xs text-slate-500">{u.phone}</p>
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
                              <tr><th className="px-3 py-2">النوع</th><th className="px-3 py-2">المصدر</th><th className="px-3 py-2">المبلغ</th><th className="px-3 py-2">الربح/العمولة</th><th className="px-3 py-2">التاريخ</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                              {orders.slice(0, 5).map(o => (
                                  <tr key={o.id}>
                                      <td className="px-3 py-2"><span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">بيع كرت</span></td>
                                      <td className="px-3 py-2">{o.networkName}</td>
                                      <td className="px-3 py-2">{o.pointsUsed}</td>
                                      <td className="px-3 py-2 text-emerald-600">+{o.masterProfit.toFixed(2)}</td>
                                      <td className="px-3 py-2 opacity-60" dir="ltr">{new Date(o.createdAt).toLocaleDateString()}</td>
                                  </tr>
                              ))}
                              {settlements.slice(0, 3).map(s => (
                                  <tr key={s.id}>
                                      <td className="px-3 py-2"><span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">سحب أرباح</span></td>
                                      <td className="px-3 py-2">{s.networkName}</td>
                                      <td className="px-3 py-2 text-rose-600">-{s.agentEarnings}</td>
                                      <td className="px-3 py-2">-</td>
                                      <td className="px-3 py-2 opacity-60" dir="ltr">{new Date(s.createdAt).toLocaleDateString()}</td>
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
             <div className="w-full space-y-6 animate-in slide-in-from-bottom-4">
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

                {/* Agent Tabs Visibility Settings */}
                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                    <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">📱 إعدادات ظهور التبويبات للوكلاء</h3>
                    <p className="text-[10px] text-slate-500 font-bold">تحكم في التبويبات التي تظهر للوكلاء في لوحة التحكم الخاصة بهم:</p>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xs">الإحصائيات الرئيسية</span>
                            <ToggleSwitch 
                                checked={systemSettings.agentVisibleTabs.stats} 
                                onChange={() => setSystemSettings({
                                    ...systemSettings,
                                    agentVisibleTabs: { ...systemSettings.agentVisibleTabs, stats: !systemSettings.agentVisibleTabs.stats }
                                })} 
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xs">إدارة الفئات</span>
                            <ToggleSwitch 
                                checked={systemSettings.agentVisibleTabs.categories} 
                                onChange={() => setSystemSettings({
                                    ...systemSettings,
                                    agentVisibleTabs: { ...systemSettings.agentVisibleTabs, categories: !systemSettings.agentVisibleTabs.categories }
                                })} 
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xs">الأرشيف</span>
                            <ToggleSwitch 
                                checked={systemSettings.agentVisibleTabs.archive} 
                                onChange={() => setSystemSettings({
                                    ...systemSettings,
                                    agentVisibleTabs: { ...systemSettings.agentVisibleTabs, archive: !systemSettings.agentVisibleTabs.archive }
                                })} 
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xs">المبيعات</span>
                            <ToggleSwitch 
                                checked={systemSettings.agentVisibleTabs.sales} 
                                onChange={() => setSystemSettings({
                                    ...systemSettings,
                                    agentVisibleTabs: { ...systemSettings.agentVisibleTabs, sales: !systemSettings.agentVisibleTabs.sales }
                                })} 
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xs">التسويات</span>
                            <ToggleSwitch 
                                checked={systemSettings.agentVisibleTabs.settlements} 
                                onChange={() => setSystemSettings({
                                    ...systemSettings,
                                    agentVisibleTabs: { ...systemSettings.agentVisibleTabs, settlements: !systemSettings.agentVisibleTabs.settlements }
                                })} 
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xs">وسائل التواصل</span>
                            <ToggleSwitch 
                                checked={systemSettings.agentVisibleTabs.contacts} 
                                onChange={() => setSystemSettings({
                                    ...systemSettings,
                                    agentVisibleTabs: { ...systemSettings.agentVisibleTabs, contacts: !systemSettings.agentVisibleTabs.contacts }
                                })} 
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xs">الإعدادات</span>
                            <ToggleSwitch 
                                checked={systemSettings.agentVisibleTabs.settings} 
                                onChange={() => setSystemSettings({
                                    ...systemSettings,
                                    agentVisibleTabs: { ...systemSettings.agentVisibleTabs, settings: !systemSettings.agentVisibleTabs.settings }
                                })} 
                            />
                        </div>
                        <button 
                            onClick={() => {
                                StorageService.saveSystemSettings(systemSettings);
                                showNotification('تم حفظ إعدادات ظهور التبويبات بنجاح', 'success');
                            }} 
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all"
                        >
                            حفظ إعدادات التبويبات
                        </button>
                    </div>
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

                <div className="glass-card p-6 rounded-[2rem] border space-y-4">
                  <h3 className="font-black text-sm border-b pb-2 flex items-center gap-2">📊 مزامنة Google Sheets</h3>
                  <p className="text-[10px] text-slate-500 font-bold">قم بمزامنة كافة بيانات النظام مع جداول Google Sheets للنسخ الاحتياطي والإحصائيات:</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button 
                      onClick={async () => {
                        setIsSyncing(true);
                        try {
                          await StorageService.calculateAndPushStats();
                          showNotification('تمت مزامنة الإحصائيات بنجاح', 'success');
                          const stats = await googleSheetsService.getStats();
                          setGoogleStats(stats);
                        } catch (e) {
                          showNotification('فشلت مزامنة الإحصائيات', 'error');
                        }
                        setIsSyncing(false);
                      }}
                      disabled={isSyncing}
                      className="p-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-[10px] border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                    >
                      {isSyncing ? 'جاري المزامنة...' : '🔄 مزامنة الإحصائيات'}
                    </button>
                    
                    <button 
                      onClick={async () => {
                        setIsSyncing(true);
                        try {
                          await googleSheetsService.syncData('users', users);
                          await googleSheetsService.syncData('agents', users.filter(u => u.role === UserRole.AGENT));
                          await googleSheetsService.syncData('categories', categories);
                          await googleSheetsService.syncData('cards', allCards);
                          await googleSheetsService.syncData('orders', orders);
                          await googleSheetsService.syncData('points_requests', pointRequests);
                          await googleSheetsService.syncData('settlements', settlements);
                          showNotification('تمت المزامنة الكاملة للبيانات بنجاح', 'success');
                        } catch (e) {
                          showNotification('فشلت المزامنة الكاملة', 'error');
                        }
                        setIsSyncing(false);
                      }}
                      disabled={isSyncing}
                      className="p-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-[10px] border border-indigo-200 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                      {isSyncing ? 'جاري المزامنة...' : '☁️ مزامنة كاملة للبيانات'}
                    </button>
                  </div>
                  
                  {googleStats && (
                    <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                      <p className="text-[9px] text-slate-400 font-bold">آخر تحديث من Google Sheets: {new Date().toLocaleString()}</p>
                    </div>
                  )}
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
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 px-1">رقم الهاتف</label>
                        <input className="w-full p-3 border rounded-xl text-xs font-bold" placeholder="رقم الهاتف" value={userForm.phone} onChange={e=>setUserForm({...userForm, phone:e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 px-1">البريد الإلكتروني</label>
                        <input className="w-full p-3 border rounded-xl text-xs font-bold" placeholder="example@mail.com" value={userForm.email} onChange={e=>setUserForm({...userForm, email:e.target.value})} />
                    </div>
                </div>

                {userForm.role === UserRole.USER && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 px-1">الرصيد الحالي (نقطة)</label>
                        <input type="number" className="w-full p-3 border rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700" placeholder="0" value={userForm.pointsBalance} onChange={e=>setUserForm({...userForm, pointsBalance:parseFloat(e.target.value)})} />
                    </div>
                )}
                
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
