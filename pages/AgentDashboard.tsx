
import React, { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { Agent, Category, Card, CardStatus, Order, Status, SettlementReport, AgentBankDetails, AgentVisibleTabs, TabConfig, AgentContact } from '../types';
import { StorageService } from '../services/storage';
import { useNotification } from '../components/Layout';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const AgentDashboard: React.FC<{ user: Agent }> = ({ user }) => {
  const { showNotification } = useNotification();

  // --- Core State ---
  const [activeTab, setActiveTab] = useState<'stats' | 'categories' | 'archive' | 'sales' | 'settlements' | 'settings' | 'contacts' | 'tickets'>('stats');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [data, setData] = useState({ 
    categories: [] as Category[], 
    orders: [] as Order[], 
    kroot: [] as Card[], 
    reports: [] as SettlementReport[],
    contacts: [] as AgentContact[],
    tickets: [] as SupportTicket[]
  });

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [agentEmail, setAgentEmail] = useState(user.email || '');

  // --- Modals State ---
  const [showAddCat, setShowAddCat] = useState(false);
  const [showEditCat, setShowEditCat] = useState<Category | null>(null);
  const [showAddCards, setShowAddCards] = useState<Category | null>(null);
  const [viewCardsCategory, setViewCardsCategory] = useState<Category | null>(null);
  const [showRequestSettlement, setShowRequestSettlement] = useState(false);
  const [showEditCard, setShowEditCard] = useState<{ id: string, code: string } | null>(null);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  
  // Bank Management State
  const [showAddBank, setShowAddBank] = useState(false);
  const [showEditBank, setShowEditBank] = useState<AgentBankDetails | null>(null);
  const [selectedBankForSettlement, setSelectedBankForSettlement] = useState<string>('');

  // Contact Management State
  const [showAddContact, setShowAddContact] = useState(false);
  const [showEditContact, setShowEditContact] = useState<AgentContact | null>(null);

  // --- Processing State ---
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string, type: 'CATEGORY' | 'CARD' | 'ARCHIVED_CARD' | 'RESET_SALES' | 'RESET_CATS' | 'RESET_CATEGORY_CARDS' | 'RESET_ARCHIVE' | 'RESET_SETTLEMENTS' | 'BANK_ACCOUNT' | 'CONTACT' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // --- Filters & Search ---
  const [searchQuery, setSearchQuery] = useState('');
  const [salesFilter, setSalesFilter] = useState<'all' | 'customer' | 'category' | 'most_sold'>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});
  const [tabsConfig, setTabsConfig] = useState<TabConfig[]>([]);

  // --- Forms ---
  const [catForm, setCatForm] = useState({ name: '', pointsPrice: 0, dataSize: '', note: '', isActive: true });
  const [cardsForm, setCardsForm] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
  
  // Bank Form
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  
  // Contact Form
  const [contactForm, setContactForm] = useState<{ type: 'whatsapp' | 'phone' | 'email', value: string }>({ type: 'whatsapp', value: '' });

  const [passwordForm, setPasswordForm] = useState({ new: '', confirm: '', pin: user.pin });

  // --- Initialization ---
  const refresh = () => {
    try {
      const agentData = StorageService.getAgentData(user.id);
      const reports = StorageService.getSettlementReports().filter(r => r.agentId === user.id);
      const agents = StorageService.getAgents();
      const currentAgent = agents.find(a => a.id === user.id);
      
      setData({
        categories: agentData.categories || [],
        orders: agentData.orders || [],
        kroot: agentData.kroot || [], 
        reports: reports || [],
        contacts: currentAgent?.contacts || [],
        tickets: StorageService.getSupportTickets(user.id, user.role)
      });
    } catch (e) {
      console.error("Refresh Error:", e);
    }
  };

  useEffect(() => {
    refresh();
  }, [user.id, activeTab]);

  useEffect(() => {
    const settings = StorageService.getSystemSettings();
    const enabledTabs = settings.agentTabs.tabs.filter(t => {
      const isVisible = (settings.agentVisibleTabs as any)[t.id] !== false;
      return t.enabled && isVisible;
    });
    setTabsConfig(enabledTabs);
    
    // If current tab is disabled, move to first enabled one
    if (!enabledTabs.some(t => t.id === activeTab) && enabledTabs.length > 0) {
      setActiveTab(enabledTabs[0].id as any);
    }
  }, [activeTab]);

  const currentUser = StorageService.getAgents().find(a => a.id === user.id);
  const agentBankAccounts = currentUser?.bankAccounts || (currentUser?.savedBankDetails ? [currentUser.savedBankDetails] : []);

  // --- Financial Calculations ---
  const calculateFinancials = () => {
    const totalEarnings = data.orders.reduce((acc, o) => acc + (o.agentEarnings || 0), 0);
    const paid = data.reports.filter(r => r.status === Status.PAID).reduce((acc, r) => acc + r.agentEarnings, 0);
    const pending = data.reports.filter(r => r.status === Status.PENDING).reduce((acc, r) => acc + r.agentEarnings, 0);
    return {
        totalEarnings,
        paid,
        pending,
        availableBalance: totalEarnings - paid - pending
    };
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return data.categories;
    const s = searchQuery.toLowerCase();
    return data.categories.filter(c => 
      c.name.toLowerCase().includes(s) || 
      c.pointsPrice.toString().includes(s)
    );
  }, [data.categories, searchQuery]);

  const filteredKroot = useMemo(() => {
    if (!searchQuery) return data.kroot;
    const s = searchQuery.toLowerCase();
    return data.kroot.filter(k => 
      k.cardNumber.toLowerCase().includes(s) ||
      k.categoryName?.toLowerCase().includes(s)
    );
  }, [data.kroot, searchQuery]);

  const financials = calculateFinancials();
  
  const agentMenuItems = tabsConfig;

  // --- Handlers ---

  // 1. Categories
  const handleSaveCategory = () => {
    if (!catForm.name || !catForm.pointsPrice) {
      showNotification('يرجى إدخال اسم الفئة والسعر', 'error');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
        if (showEditCat) {
            StorageService.updateCategory(showEditCat.id, catForm);
            showNotification('تم تحديث الفئة بنجاح ✅', 'success');
        } else {
            StorageService.addCategory({ ...catForm, agentId: user.id });
            showNotification('تمت إضافة الفئة بنجاح ✨', 'success');
        }
        setIsProcessing(false);
        closeModals();
        refresh();
    }, 500);
  };

  const handleDeleteCategory = (id: string) => {
    StorageService.deleteCategory(id);
    setDeleteTarget(null);
    refresh();
    showNotification('تم حذف الفئة وكروتها المتاحة بنجاح (تم حفظ الأرشيف) 🗑️', 'info');
  };

  // 2. Cards Management
  const handleAddCards = () => {
    if (!showAddCards || !cardsForm.trim()) {
      showNotification('لا توجد كروت للإضافة', 'error');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
        const codes = cardsForm.split('\n').filter(c => c.trim().length > 0);
        const res = StorageService.addCards(user.id, showAddCards.id, codes);
        
        if (res.added > 0) {
            showNotification(`تم إضافة ${res.added} كرت بنجاح ✅`, 'success');
        }
        
        if (res.duplicates.length > 0) {
            const firstDup = res.duplicates[0];
            const dupMsg = res.duplicates.length === 1 
                ? `تم استبعاد الكود ${firstDup.code} لأنه موجود في فئة '${firstDup.category}'`
                : `تم استبعاد ${res.duplicates.length} كروت مكررة ⚠️`;
            showNotification(dupMsg, 'error');
            
            if (res.duplicates.length > 1) {
                console.warn("Duplicate codes found:", res.duplicates);
            }
        }
        
        if (res.added === 0 && res.duplicates.length === 0) {
            showNotification('لم يتم إضافة أي كروت', 'info');
        }
        
        setIsProcessing(false);
        closeModals();
        refresh();
    }, 500);
  };

  const handleUpdateCardCode = () => {
      if (!showEditCard || !showEditCard.code.trim()) return;
      StorageService.updateCardCode(showEditCard.id, showEditCard.code);
      showNotification('تم تعديل رقم الكرت بنجاح ✅', 'success');
      setShowEditCard(null);
      refresh();
  };

  const handleDeleteCard = (id: string) => {
      StorageService.deleteCard(id);
      refresh();
      setDeleteTarget(null);
      showNotification('تم حذف الكرت بنجاح 🗑️');
  };

  const handleArchiveCard = (id: string) => {
      StorageService.archiveCard(id);
      refresh();
      showNotification('تم نقل الكرت للأرشيف 📦');
  };

  const handleRestoreCard = (id: string) => {
      StorageService.restoreCard(id);
      refresh();
      showNotification('تم استعادة الكرت للمخزون ♻️', 'success');
  };

  // 3. Settlements
  const handleRequestSettlement = () => {
    const amount = parseFloat(settlementAmount);
    
    if (!selectedBankForSettlement) {
        showNotification('يرجى اختيار حساب بنكي لاستلام الأرباح', 'error');
        return;
    }
    if (!amount || amount <= 0) return showNotification('المبلغ غير صحيح', 'error');
    if (amount > financials.availableBalance) return showNotification('الرصيد غير كافٍ', 'error');

    try {
        StorageService.createSettlementRequest(user.id, amount, selectedBankForSettlement);
        showNotification('تم إرسال طلب السحب بنجاح 🚀', 'success');
        closeModals();
        refresh();
    } catch (e: any) {
        showNotification(e.message, 'error');
    }
  };

  // 4. Bank Management Handlers
  const handleSaveBank = () => {
      if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.accountHolder) {
          showNotification('يرجى ملء جميع بيانات البنك', 'error');
          return;
      }
      if (showEditBank) {
          StorageService.updateAgentBankAccount(user.id, showEditBank.id, bankForm);
          showNotification('تم تحديث الحساب البنكي ✅', 'success');
      } else {
          StorageService.addAgentBankAccount(user.id, bankForm);
          showNotification('تم إضافة الحساب البنكي ✅', 'success');
      }
      setBankForm({ bankName: '', accountNumber: '', accountHolder: '' });
      setShowAddBank(false);
      setShowEditBank(null);
      refresh();
  };

  const handleToggleBank = (bankId: string, currentStatus: boolean) => {
      StorageService.updateAgentBankAccount(user.id, bankId, { isActive: !currentStatus });
      refresh();
      showNotification(!currentStatus ? 'تم تفعيل الحساب البنكي' : 'تم تعطيل الحساب البنكي');
  };

  // 5. Contact Management Handlers
  const handleSaveContact = () => {
      if (!contactForm.value) {
          showNotification('يرجى إدخال قيمة وسيلة التواصل', 'error');
          return;
      }
      if (showEditContact) {
          StorageService.updateAgentContact(user.id, showEditContact.id, contactForm);
          showNotification('تم تحديث وسيلة التواصل ✅', 'success');
      } else {
          StorageService.addAgentContact(user.id, contactForm);
          showNotification('تم إضافة وسيلة التواصل ✅', 'success');
      }
      setContactForm({ type: 'whatsapp', value: '' });
      setShowAddContact(false);
      setShowEditContact(null);
      refresh();
  };

  const handleToggleContact = (contactId: string) => {
      StorageService.toggleAgentContact(user.id, contactId);
      refresh();
      showNotification('تم تحديث حالة وسيلة التواصل');
  };

  const closeModals = () => {
    setShowAddCat(false);
    setShowEditCat(null);
    setShowAddCards(null);
    setViewCardsCategory(null);
    setShowRequestSettlement(false);
    setShowEditCard(null);
    setCatForm({ name: '', pointsPrice: 0, dataSize: '', note: '', isActive: true });
    setCardsForm('');
    setSettlementAmount('');
    setDeleteTarget(null);
    setIsProcessing(false);
    setShowAddBank(false);
    setShowEditBank(null);
    setBankForm({ bankName: '', accountNumber: '', accountHolder: '' });
    setShowAddContact(false);
    setShowEditContact(null);
    setContactForm({ type: 'whatsapp', value: '' });
    setShowPrintConfirm(false);
  };

  // --- Filtering Orders ---
  const getFilteredOrders = () => {
      let orders = [...data.orders];

      // Handle "Most Sold" logic - this is more of a sort/grouping but we'll adapt it
      if (salesFilter === 'most_sold') {
          const counts: Record<string, number> = {};
          orders.forEach(o => counts[o.categoryName] = (counts[o.categoryName] || 0) + 1);
          orders.sort((a, b) => (counts[b.categoryName] || 0) - (counts[a.categoryName] || 0));
      }

      return orders.filter(o => {
          let matchesSearch = true;
          if (salesFilter === 'customer') {
              matchesSearch = o.userName.toLowerCase().includes(searchQuery.toLowerCase());
          } else if (salesFilter === 'category') {
              matchesSearch = o.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
          } else {
              matchesSearch = o.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            o.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
          }

          const orderDate = new Date(o.createdAt);
          const start = dateRange.start ? new Date(dateRange.start) : null;
          const end = dateRange.end ? new Date(dateRange.end) : null;
          
          if (end) end.setHours(23, 59, 59);

          const matchesDate = (!start || orderDate >= start) && (!end || orderDate <= end);
          return matchesSearch && matchesDate;
      }).sort((a,b) => {
          if (salesFilter === 'most_sold') return 0; // Keep the most_sold sort
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  };

  const filteredOrders = getFilteredOrders();

  // --- Print Handler (Fixed for Download) ---
  const handlePrintRequest = () => {
      setShowPrintConfirm(true);
  };

  const confirmPrint = async () => {
      setShowPrintConfirm(false);
      setIsGeneratingPDF(true);
      
      const element = document.getElementById('pdf-generator-container');
      if (!element) {
          showNotification('حدث خطأ: حاوية التقرير غير موجودة', 'error');
          setIsGeneratingPDF(false);
          return;
      }

      // Updated Option: Use position absolute off-screen instead of display:none
      // This ensures html2canvas can capture the element.
      
      const opt = {
          margin: 10,
          filename: `Quantum_Report_${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      try {
          if (typeof html2pdf === 'undefined') {
              throw new Error('مكتبة PDF غير محملة');
          }
          await html2pdf().set(opt).from(element).save();
          showNotification('تم تحميل ملف PDF بنجاح ✅', 'success');
      } catch (err: any) {
          console.error("PDF Error:", err);
          showNotification('فشل تحميل ملف PDF: ' + (err.message || 'خطأ غير معروف'), 'error');
      } finally {
          setIsGeneratingPDF(false);
      }
  };

  // --- Reset / Clear Handlers ---
  const handleResetAction = () => {
      if (!deleteTarget) return;

      switch (deleteTarget.type) {
          case 'RESET_SALES':
              StorageService.clearAgentSales(user.id);
              showNotification('تم تصفير سجل المبيعات بنجاح ✅', 'success');
              break;
          case 'RESET_CATS':
              // Updated to use the SAFE function that preserves sold/archived cards
              StorageService.clearAgentCategories(user.id);
              showNotification('تم حذف الفئات والكروت المتاحة فقط ✅', 'success');
              break;
          case 'RESET_CATEGORY_CARDS':
              // Calls the new safer function
              StorageService.clearCategoryInventory(user.id, deleteTarget.id);
              showNotification('تم تصفير كروت الفئة بنجاح (المتاحة فقط) ✅', 'success');
              break;
          case 'RESET_ARCHIVE':
              StorageService.clearAgentArchive(user.id);
              showNotification('تم تصفير الأرشيف بنجاح ✅', 'success');
              break;
          case 'RESET_SETTLEMENTS':
              StorageService.clearAgentSettlements(user.id);
              showNotification('تم تصفير سجل التسويات بنجاح ✅', 'success');
              break;
          case 'BANK_ACCOUNT':
              StorageService.deleteAgentBankAccount(user.id, deleteTarget.id);
              showNotification('تم حذف الحساب البنكي 🗑️');
              break;
          case 'CONTACT':
              StorageService.deleteAgentContact(user.id, deleteTarget.id);
              showNotification('تم حذف وسيلة التواصل 🗑️');
              break;
          case 'CATEGORY':
              StorageService.deleteCategory(deleteTarget.id);
              showNotification('تم حذف الفئة والكروت المتاحة فقط (تم حفظ الأرشيف) ✅', 'success');
              break;
      }
      setDeleteTarget(null);
      refresh();
  };

  const stats = {
      cats: data.categories.length,
      available: data.kroot.filter(k => k.status === CardStatus.AVAILABLE).length,
      sold: data.kroot.filter(k => k.status === CardStatus.SOLD).length,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-indigo-950 flex transition-all duration-300 text-sm overflow-x-hidden">
      
      {/* Sidebar */}
      <aside className={`fixed top-0 right-0 z-50 h-screen bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/5 shadow-2xl transition-transform duration-300 w-64 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:w-0'}`}>
          <div className="h-24 flex items-center justify-center border-b border-slate-100 dark:border-white/5 bg-indigo-950 text-white">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-lg">📡</div>
                  <div className="text-right">
                      <h1 className="font-black text-sm leading-none">{user.networkName}</h1>
                      <p className="text-[9px] opacity-60 mt-1 font-bold">لوحة تحكم الوكيل</p>
                  </div>
              </div>
          </div>

          <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-160px)] no-scrollbar">
              {agentMenuItems.map(item => (
                  <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id as any); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black text-xs transition-all duration-200 ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-[-4px]' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-600'}`}
                  >
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.label}</span>
                  </button>
              ))}
          </nav>

          <div className="absolute bottom-0 right-0 w-full p-4 border-t dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-black">👤</div>
                  <div className="text-right overflow-hidden">
                      <p className="text-[10px] font-black truncate">{user.fullName}</p>
                      <p className="text-[8px] text-slate-400 font-bold truncate">{user.phone}</p>
                  </div>
              </div>
          </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'mr-64' : 'mr-0'} p-4 lg:p-8 max-w-full overflow-hidden`}>
          
          {/* Mobile Toggle & Header */}
          <div className="flex justify-between items-center mb-8 lg:hidden">
              <h1 className="font-black text-lg text-indigo-900 dark:text-white">لوحة التحكم</h1>
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 bg-white dark:bg-white/5 rounded-2xl shadow-sm text-indigo-600 border dark:border-white/10">
                  {isSidebarOpen ? '✕' : '☰'}
              </button>
          </div>

          {/* Desktop Toggle (Floating) */}
          <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className={`hidden lg:flex fixed top-6 ${isSidebarOpen ? 'right-60' : 'right-6'} z-[60] w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-xl border border-slate-100 dark:border-white/10 items-center justify-center text-indigo-600 transition-all duration-300 hover:scale-110 active:scale-95`}
          >
              {isSidebarOpen ? '→' : '←'}
          </button>

      <div className="w-full m-0 p-2 space-y-8">
      
      {/* Hidden Container for PDF Generation */}
      <div style={{ height: 0, overflow: 'hidden', position: 'absolute' }}>
        <div id="pdf-generator-container" style={{ 
            width: '290mm', // A4 Landscape width
            minHeight: '210mm',
            backgroundColor: '#ffffff', 
            color: '#000000', 
            padding: '20px', 
            direction: 'rtl', 
            fontFamily: 'Cairo, sans-serif',
        }}>
          <div style={{ borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                 <div style={{ fontSize: '24px', fontWeight: 'bold', backgroundColor: '#000', color: '#fff', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>Q</div>
                 <div>
                     <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>كوانتوم واي فاي</h1>
                     <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>شبكة: {user.networkName}</p>
                 </div>
             </div>
             <div style={{ textAlign: 'left' }}>
                 <h2 style={{ fontSize: '18px', margin: 0 }}>تقرير المبيعات المالي</h2>
                 <p style={{ margin: 0, fontSize: '12px' }}>تاريخ التقرير: {new Date().toLocaleDateString('ar-YE')}</p>
             </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>#</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>العميل</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>الفئة</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>رقم الكرت</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>التاريخ</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>السعر</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>العمولة</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>الربح</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', backgroundColor: '#d1fae5', color: '#047857' }}>الصافي</th>
                </tr>
            </thead>
            <tbody>
                {filteredOrders.map((o, idx) => (
                    <tr key={o.id}>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{o.userName}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{o.categoryName}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', fontFamily: 'monospace' }}>{StorageService.decryptCardCode(o.cardNumber)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }} dir="ltr">{new Date(o.createdAt).toLocaleString('ar-YE')}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{o.pointsUsed}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.profitPercentage}%</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', color: '#e11d48' }}>{o.masterProfit.toFixed(2)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 'bold' }}>{o.agentEarnings.toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                 <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                     <td colSpan={5} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>الإجمالي الكلي</td>
                     <td style={{ border: '1px solid #ddd', padding: '8px' }}>{filteredOrders.reduce((a,b) => a + b.pointsUsed, 0)}</td>
                     <td style={{ border: '1px solid #ddd', padding: '8px' }}>-</td>
                     <td style={{ border: '1px solid #ddd', padding: '8px', color: '#e11d48' }}>{filteredOrders.reduce((a,b) => a + b.masterProfit, 0).toFixed(2)}</td>
                     <td style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#d1fae5', color: '#047857' }}>{filteredOrders.reduce((a,b) => a + b.agentEarnings, 0).toFixed(2)}</td>
                 </tr>
            </tfoot>
        </table>
        
        <div style={{ marginTop: '30px', borderTop: '1px solid #ddd', paddingTop: '10px', textAlign: 'center', fontSize: '10px', color: '#666' }}>
            <p>تم استخراج هذا التقرير من نظام كوانتوم واي فاي</p>
        </div>
      </div>
    </div>

      {/* Financial Summary Card */}
      <div className="glass-card p-6 rounded-[3rem] bg-indigo-950 text-white flex flex-wrap justify-between items-center relative overflow-hidden shadow-2xl print:hidden">
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 to-transparent pointer-events-none"></div>
         <div className="flex items-center gap-4 z-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-3xl shadow-lg">📡</div>
            <div>
               <h2 className="text-xl font-black">{user.networkName}</h2>
               <p className="text-[10px] opacity-70 font-bold tracking-widest">{user.fullName}</p>
            </div>
         </div>
         <div className="z-10 mt-4 md:mt-0 text-left">
             <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest">الرصيد المستحق للوكيل</p>
             <div className="text-3xl font-black text-emerald-400 drop-shadow-md">{financials.availableBalance.toFixed(1)} <span className="text-sm">ن</span></div>
         </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
         
         {/* 1. STATS DASHBOARD */}
         {activeTab === 'stats' && (
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4">
                 <div className="glass-card p-6 rounded-[2.5rem] bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10">
                     <p className="text-[9px] font-black opacity-50 uppercase tracking-widest">الفئات</p>
                     <h3 className="text-3xl font-black text-indigo-600 mt-2">{stats.cats}</h3>
                 </div>
                 <div className="glass-card p-6 rounded-[2.5rem] bg-emerald-50 dark:bg-white/5 border border-emerald-100 dark:border-white/10">
                     <p className="text-[9px] font-black opacity-50 uppercase tracking-widest">كروت متاحة</p>
                     <h3 className="text-3xl font-black text-emerald-600 mt-2">{stats.available}</h3>
                 </div>
                 <div className="glass-card p-6 rounded-[2.5rem] bg-amber-50 dark:bg-white/5 border border-amber-100 dark:border-white/10">
                     <p className="text-[9px] font-black opacity-50 uppercase tracking-widest">كروت مباعة</p>
                     <h3 className="text-3xl font-black text-amber-600 mt-2">{stats.sold}</h3>
                 </div>
                 <div className="glass-card p-6 rounded-[2.5rem] bg-cyan-50 dark:bg-white/5 border border-cyan-100 dark:border-white/10">
                     <p className="text-[9px] font-black opacity-50 uppercase tracking-widest">إجمالي المبيعات</p>
                     <h3 className="text-3xl font-black text-cyan-600 mt-2">{financials.totalEarnings.toFixed(0)}</h3>
                 </div>
                 
                 <div className="col-span-2 lg:col-span-4 glass-card p-6 rounded-[2.5rem] border mt-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-sm">🔔 آخر عمليات البيع</h3>
                        <button onClick={() => setDeleteTarget({id: 'all', name: 'سجل المبيعات بالكامل', type: 'RESET_SALES'})} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors">🗑️ تصفير حركة المبيعات</button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                        {data.orders.slice(0, 5).map(o => (
                            <div key={o.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                <span className="text-[10px] font-bold">تم بيع كرت <span className="text-indigo-600">{o.categoryName}</span> للعميل {o.userName}</span>
                                <span className="text-[9px] opacity-50">{new Date(o.createdAt).toLocaleString('ar-YE')}</span>
                            </div>
                        ))}
                        {data.orders.length === 0 && <p className="text-center text-slate-400 text-xs">لا توجد عمليات حديثة</p>}
                    </div>
                 </div>
             </div>
         )}

         {/* 2. CATEGORIES MANAGEMENT */}
         {activeTab === 'categories' && (
             <div className="space-y-6 animate-in slide-in-from-bottom-4">
                 <div className="flex flex-wrap gap-2 justify-between items-center">
                     <h3 className="font-black text-lg px-2">إدارة الفئات والمخزون</h3>
                     
                     <div className="flex-1 max-w-md relative group">
                       <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                         <Icons.Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                       </div>
                       <input 
                         type="text" 
                         placeholder="بحث في الفئات أو الكروت..." 
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                         className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-3 pr-11 rounded-2xl font-bold text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                       />
                     </div>
                     <div className="flex gap-2">
                        {/* Updated Global Reset Button */}
                        <button onClick={() => setDeleteTarget({id: 'all', name: 'جميع الفئات', type: 'RESET_CATS'})} className="px-4 py-3 bg-rose-50 text-rose-600 rounded-[1.5rem] font-black text-[10px] hover:bg-rose-100 transition-colors">🗑️ تصفير الفئات</button>
                        <button onClick={() => setShowAddCat(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95">+ إضافة فئة جديدة</button>
                     </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {filteredCategories.map(c => {
                         const count = data.kroot.filter(k => k.categoryId === c.id && k.status === CardStatus.AVAILABLE).length;
                         return (
                             <div key={c.id} className={`glass-card p-6 rounded-[2.5rem] border transition-all ${!c.isActive ? 'opacity-60 grayscale' : 'hover:shadow-xl hover:-translate-y-1'}`}>
                                 <div className="flex justify-between items-start mb-4">
                                     <div>
                                         <h3 className="font-black text-lg leading-none mb-1">{c.name}</h3>
                                         <p className="text-[10px] font-bold text-slate-400">{c.pointsPrice} نقطة</p>
                                     </div>
                                     <button onClick={() => { StorageService.updateCategory(c.id, { isActive: !c.isActive }); refresh(); }} className={`w-10 h-6 rounded-full relative transition-colors ${c.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                         <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${c.isActive ? 'right-5' : 'right-1'}`} />
                                     </button>
                                 </div>
                                 <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl flex justify-between items-center mb-4">
                                     <span className="text-[10px] font-black opacity-60">المخزون المتاح</span>
                                     <span className={`text-sm font-black ${count > 0 ? 'text-indigo-600' : 'text-rose-500'}`}>{count} كرت</span>
                                 </div>
                                 <div className="grid grid-cols-2 gap-2 mb-2">
                                     <button onClick={() => setShowAddCards(c)} className="py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black hover:bg-indigo-700">إضافة كروت 📥</button>
                                     <button onClick={() => setViewCardsCategory(c)} className="py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black hover:bg-slate-200">عرض الكروت 👁️</button>
                                 </div>
                                 <div className="flex gap-2 border-t dark:border-white/5 pt-3 mt-3">
                                     <button onClick={() => { setCatForm(c); setShowEditCat(c); }} className="flex-1 text-[10px] font-black text-indigo-500 hover:bg-indigo-50 py-2 rounded-xl">تعديل ✏️</button>
                                     {/* Scoped Reset Button */}
                                     <button onClick={() => setDeleteTarget({id: c.id, name: c.name, type: 'RESET_CATEGORY_CARDS'})} className="flex-1 text-[10px] font-black text-amber-500 hover:bg-amber-50 py-2 rounded-xl">تصفير كروت ⚠️</button>
                                     <button onClick={() => setDeleteTarget({id: c.id, name: c.name, type: 'CATEGORY'})} className="flex-1 text-[10px] font-black text-rose-500 hover:bg-rose-50 py-2 rounded-xl">حذف 🗑️</button>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>
         )}

         {/* 3. ARCHIVE */}
         {activeTab === 'archive' && (
             <div className="glass-card rounded-[2.5rem] overflow-hidden border animate-in slide-in-from-bottom-4">
                 <div className="p-4 border-b dark:border-white/5 bg-slate-50 dark:bg-white/5 flex justify-between items-center">
                     <div>
                        <h3 className="font-black text-slate-700 dark:text-slate-200">أرشيف الكروت المباعة والمحذوفة</h3>
                        <p className="text-[10px] font-bold text-slate-400">يحتفظ النظام بالكروت المباعة للأمان</p>
                     </div>
                     <button onClick={() => setDeleteTarget({id: 'all', name: 'الأرشيف بالكامل', type: 'RESET_ARCHIVE'})} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors">🗑️ تصفير الأرشيف</button>
                 </div>
                 <div className="overflow-x-auto overflow-y-auto max-h-[400px] no-scrollbar">
                    <table className="w-full text-right text-[10px] border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-500 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2">الكود</th>
                                <th className="px-3 py-2">الفئة</th>
                                <th className="px-3 py-2">تاريخ الإضافة</th>
                                <th className="px-3 py-2">تاريخ العملية</th>
                                <th className="px-3 py-2">الحالة</th>
                                <th className="px-3 py-2 text-center">إجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                            {data.kroot.filter(k => k.status !== CardStatus.AVAILABLE).map(k => {
                                const cat = data.categories.find(c => c.id === k.categoryId);
                                return (
                                    <tr key={k.id}>
                                        <td className="px-3 py-2 font-mono text-indigo-600">
                                            {revealedCards[k.id] ? StorageService.decryptCardCode(k.cardNumber) : '••••••••'}
                                            <button onClick={() => setRevealedCards({...revealedCards, [k.id]: !revealedCards[k.id]})} className="mr-2 opacity-50">👁️</button>
                                        </td>
                                        <td className="px-3 py-2 opacity-70">{cat?.name || 'فئة محذوفة'}</td>
                                        <td className="px-3 py-2 opacity-60" dir="ltr">{k.createdAt ? new Date(k.createdAt).toLocaleString('ar-YE') : '-'}</td>
                                        <td className="px-3 py-2 opacity-60" dir="ltr">{k.soldAt ? new Date(k.soldAt).toLocaleString('ar-YE') : '-'}</td>
                                        <td className="px-3 py-2"><span className={`px-2 py-1 rounded-md ${k.status === CardStatus.SOLD ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>{k.status === CardStatus.SOLD ? 'مباع' : 'مؤرشف'}</span></td>
                                        <td className="px-3 py-2 flex justify-center gap-2">
                                            <button onClick={() => { navigator.clipboard.writeText(StorageService.decryptCardCode(k.cardNumber)); showNotification('تم النسخ'); }} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200">📋 نسخ</button>
                                            {k.status === CardStatus.ARCHIVED && (
                                               <>
                                                   <button onClick={() => handleRestoreCard(k.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100">♻️ استعادة</button>
                                                   <button onClick={() => setDeleteTarget({id: k.id, name: 'هذا الكرت', type: 'ARCHIVED_CARD'})} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100">🗑️ حذف</button>
                                               </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
             </div>
         )}

         {/* 4. SALES / ACCOUNTING */}
         {activeTab === 'sales' && (
             <div className="space-y-4 animate-in slide-in-from-bottom-4">
                 {/* Filter Tabs */}
                 <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                     {[
                         { id: 'all', label: 'الكل', icon: '📋' },
                         { id: 'customer', label: 'حسب العميل', icon: '👤' },
                         { id: 'category', label: 'حسب الفئة', icon: '🎫' },
                         { id: 'most_sold', label: 'الأكثر مبيعاً', icon: '🔥' },
                     ].map(f => (
                         <button
                             key={f.id}
                             onClick={() => setSalesFilter(f.id as any)}
                             className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-2 border ${salesFilter === f.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-indigo-300'}`}
                         >
                             <span>{f.icon}</span>
                             <span>{f.label}</span>
                         </button>
                     ))}
                 </div>

                 {/* Header & Actions */}
                 <div className="flex flex-wrap gap-4 items-end justify-between print:hidden">
                     <div className="flex flex-wrap gap-2 items-center flex-1">
                         <div className="relative flex-1 min-w-[200px]">
                             <input type="text" placeholder={salesFilter === 'customer' ? "بحث باسم العميل..." : salesFilter === 'category' ? "بحث باسم الفئة..." : "بحث عام..."} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-xs outline-none focus:border-indigo-500" />
                             <span className="absolute left-3 top-3 opacity-30">🔍</span>
                         </div>
                         <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-xs outline-none" />
                         <span className="opacity-50">إلى</span>
                         <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-xs outline-none" />
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setDeleteTarget({id: 'all', name: 'سجل المبيعات بالكامل', type: 'RESET_SALES'})} className="px-4 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs hover:bg-rose-100">🗑️ تصفير السجل</button>
                        <button onClick={handlePrintRequest} className="px-6 py-3 bg-slate-800 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 hover:bg-slate-700">
                            <span>🖨️</span> {isGeneratingPDF ? 'جاري التحميل...' : 'طباعة التقرير (PDF)'}
                        </button>
                     </div>
                 </div>

                 {/* Sales Table (Display Only) */}
                 <div className="glass-card rounded-[2.5rem] overflow-hidden border">
                     <div className="overflow-x-auto overflow-y-auto max-h-[400px] no-scrollbar">
                        <table className="w-full text-right text-[10px] border-collapse">
                            <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-700 dark:text-slate-300 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">العميل</th>
                                    <th className="px-3 py-2">الفئة</th>
                                    <th className="px-3 py-2">رقم الكرت</th>
                                    <th className="px-3 py-2">التاريخ والوقت</th>
                                    <th className="px-3 py-2">سعر البيع</th>
                                    <th className="px-3 py-2">العمولة</th>
                                    <th className="px-3 py-2">ربح النظام</th>
                                    <th className="px-3 py-2 bg-emerald-50/50 text-emerald-700">صافي الوكيل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold text-slate-600 dark:text-slate-400">
                                {filteredOrders.map((o, idx) => (
                                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                        <td className="px-3 py-2">{idx + 1}</td>
                                        <td className="px-3 py-2">{o.userName}</td>
                                        <td className="px-3 py-2">{o.categoryName}</td>
                                        <td className="px-3 py-2 font-mono text-indigo-600">
                                            {revealedCards[o.id] ? StorageService.decryptCardCode(o.cardNumber) : '••••••••'}
                                            <button onClick={() => setRevealedCards({...revealedCards, [o.id]: !revealedCards[o.id]})} className="mr-1 opacity-50 hover:opacity-100">👁️</button>
                                        </td>
                                        <td className="px-3 py-2 opacity-70" dir="ltr">{new Date(o.createdAt).toLocaleString('ar-YE')}</td>
                                        <td className="px-3 py-2">{o.pointsUsed}</td>
                                        <td className="px-3 py-2">{user.profitPercentage}%</td>
                                        <td className="px-3 py-2 text-rose-500">{o.masterProfit.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-emerald-600 bg-emerald-50/30 font-black">{o.agentEarnings.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 dark:bg-white/10 font-black text-xs">
                                <tr>
                                    <td colSpan={5} className="px-3 py-2 text-center">الإجمالي الكلي</td>
                                    <td className="px-3 py-2">{filteredOrders.reduce((a,b) => a + b.pointsUsed, 0)}</td>
                                    <td className="px-3 py-2">-</td>
                                    <td className="px-3 py-2 text-rose-600">{filteredOrders.reduce((a,b) => a + b.masterProfit, 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-emerald-600 bg-emerald-100/50">{filteredOrders.reduce((a,b) => a + b.agentEarnings, 0).toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                     </div>
                 </div>
             </div>
         )}

         {/* 5. SETTLEMENTS */}
         {activeTab === 'settlements' && (
             <div className="space-y-6 animate-in slide-in-from-bottom-4">
                 <div className="glass-card p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-900 to-indigo-800 text-white relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                     <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                         <div>
                             <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">الرصيد المتاح للسحب</p>
                             <h2 className="text-4xl font-black">{financials.availableBalance.toFixed(2)} <span className="text-lg opacity-80">نقطة</span></h2>
                             <p className="text-[10px] mt-2 opacity-70">إجمالي الأرباح الكلية: {financials.totalEarnings.toFixed(2)} | قيد التنفيذ: {financials.pending.toFixed(2)}</p>
                         </div>
                         <button onClick={() => setShowRequestSettlement(true)} className="px-8 py-4 bg-white text-indigo-900 rounded-[2rem] font-black text-xs shadow-lg hover:scale-105 active:scale-95 transition-all">
                             طلب سحب الأرباح 💸
                         </button>
                     </div>
                 </div>

                 <div className="glass-card rounded-[2.5rem] overflow-hidden border">
                     <div className="p-5 border-b dark:border-white/5 bg-slate-50 dark:bg-white/5 flex justify-between items-center">
                        <h3 className="font-black text-slate-700 dark:text-slate-200">سجل طلبات التسوية</h3>
                        <button onClick={() => setDeleteTarget({id: 'all', name: 'سجل التسويات', type: 'RESET_SETTLEMENTS'})} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors">🗑️ تصفير السجل</button>
                     </div>
                      <div className="overflow-x-auto overflow-y-auto max-h-[400px] no-scrollbar">
                        <table className="w-full text-right text-[10px] border-collapse">
                            <thead className="bg-slate-50 dark:bg-white/5 font-black text-slate-500 sticky top-0 z-10">
                                <tr><th className="px-3 py-2">رقم الطلب</th><th className="px-3 py-2">التاريخ</th><th className="px-3 py-2">المبلغ</th><th className="px-3 py-2">معلومات البنك</th><th className="px-3 py-2">الحالة</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                             {data.reports.map(r => (
                                 <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                     <td className="px-3 py-2 font-mono text-indigo-600">{r.id}</td>
                                     <td className="px-3 py-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                                     <td className="px-3 py-2 font-black text-base">{r.agentEarnings}</td>
                                     <td className="px-3 py-2 opacity-70">
                                         {r.bankDetails.bankName} - {r.bankDetails.accountNumber}
                                     </td>
                                     <td className="px-3 py-2">
                                         <div className="flex flex-col items-start gap-1">
                                             <span className={`px-2 py-1 rounded text-[9px] ${r.status === Status.PAID ? 'bg-emerald-100 text-emerald-600' : r.status === Status.REJECTED ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                                {r.status === Status.PAID ? 'تم التحويل' : r.status === Status.REJECTED ? 'مرفوض' : 'قيد الانتظار'}
                                             </span>
                                             {r.status === Status.PAID && r.referenceNumber && <span className="text-[8px] text-emerald-600 font-mono">Ref: {r.referenceNumber}</span>}
                                             {r.status === Status.REJECTED && r.adminNotes && <span className="text-[8px] text-rose-600 max-w-[100px] truncate">{r.adminNotes}</span>}
                                         </div>
                                     </td>
                                 </tr>
                             ))}
                             {data.reports.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد طلبات سابقة</td></tr>}
                         </tbody>
                     </table>
                 </div>
             </div>
         </div>
         )}

                   {/* 5.5 TICKETS */}
          {activeTab === 'tickets' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black">تذاكر الدعم الفني</h2>
                  <p className="text-xs text-slate-400 font-bold">إدارة طلبات المساعدة من المستخدمين</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 glass-card p-6 rounded-[2.5rem] border overflow-hidden">
                  <div className="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar">
                    {data.tickets.map(ticket => (
                      <div 
                        key={ticket.id} 
                        onClick={() => setSelectedTicket(ticket)}
                        className={cn(
                          "p-4 rounded-2xl border cursor-pointer transition-all",
                          selectedTicket?.id === ticket.id ? "bg-indigo-50 border-indigo-200" : "bg-white dark:bg-white/5 hover:bg-slate-50 border-slate-100 dark:border-white/10"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-sm truncate flex-1">{ticket.title}</h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black",
                            ticket.status === TicketStatus.OPEN ? "bg-indigo-100 text-indigo-600" :
                            ticket.status === TicketStatus.IN_PROGRESS ? "bg-amber-100 text-amber-600" :
                            "bg-slate-100 text-slate-500"
                          )}>
                            {ticket.status === TicketStatus.OPEN ? 'جديدة' :
                             ticket.status === TicketStatus.IN_PROGRESS ? 'قيد المعالجة' : 'مغلقة'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold mb-1">{ticket.userName}</p>
                        <p className="text-[9px] text-slate-400">{new Date(ticket.createdAt).toLocaleDateString('ar-YE')}</p>
                      </div>
                    ))}
                    {data.tickets.length === 0 && (
                      <div className="text-center py-20 opacity-20">
                        <Icons.Ticket size={48} className="mx-auto mb-4" />
                        <p className="font-black text-xs">لا توجد تذاكر حالياً</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2 glass-card p-8 rounded-[2.5rem] border min-h-[400px]">
                  {selectedTicket ? (
                    <div className="flex flex-col h-full">
                      <div className="flex justify-between items-start border-b dark:border-white/5 pb-6 mb-6">
                        <div>
                          <h3 className="text-xl font-black mb-2">{selectedTicket.title}</h3>
                          <div className="flex items-center gap-4 text-xs text-slate-400 font-bold">
                            <span>المستخدم: {selectedTicket.userName}</span>
                            <span>الهاتف: {selectedTicket.userPhone}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <select 
                            value={selectedTicket.status}
                            onChange={(e) => {
                              StorageService.updateTicketStatus(selectedTicket.id, e.target.value as TicketStatus);
                              showNotification('تم تحديث حالة التذكرة');
                              refresh();
                            }}
                            className="bg-slate-50 dark:bg-white/5 border dark:border-white/10 rounded-xl px-3 py-1.5 text-[10px] font-black outline-none"
                          >
                            <option value={TicketStatus.OPEN}>مفتوحة</option>
                            <option value={TicketStatus.IN_PROGRESS}>قيد المعالجة</option>
                            <option value={TicketStatus.CLOSED}>مغلقة</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex-1 space-y-6 mb-8 overflow-y-auto max-h-[400px] no-scrollbar">
                        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl">
                          <p className="text-sm leading-relaxed">{selectedTicket.message}</p>
                        </div>

                        {selectedTicket.replies?.map((reply, idx) => (
                          <div key={idx} className={cn("flex gap-3", reply.senderId === user.id ? "flex-row-reverse" : "")}>
                            <div className="w-10 h-10 bg-slate-200 dark:bg-white/5 rounded-full flex items-center justify-center text-sm">👤</div>
                            <div className={cn("max-w-[80%] p-4 rounded-3xl", reply.senderId === user.id ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-white/10")}>
                              <p className="text-[10px] font-black mb-1 opacity-70">{reply.senderName}</p>
                              <p className="text-xs">{reply.message}</p>
                              <p className="text-[8px] mt-2 opacity-50">{new Date(reply.createdAt).toLocaleTimeString('ar-YE')}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto">
                        <div className="flex gap-3">
                          <textarea 
                            value={replyMessage}
                            onChange={e => setReplyMessage(e.target.value)}
                            placeholder="اكتب ردك هنا..."
                            className="flex-1 bg-slate-50 dark:bg-white/5 border dark:border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:border-indigo-600 resize-none"
                            rows={2}
                          />
                          <button 
                            onClick={() => {
                              if (!replyMessage) return;
                              StorageService.addTicketReply(selectedTicket.id, {
                                senderId: user.id,
                                senderName: user.networkName,
                                message: replyMessage
                              });
                              setReplyMessage('');
                              showNotification('تم إرسال الرد ✅');
                              refresh();
                            }}
                            className="px-6 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:scale-105 transition-all"
                          >
                            إرسال
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20">
                      <Icons.MessageSquare size={64} className="mb-4" />
                      <p className="font-black">اختر تذكرة لعرض التفاصيل</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 6. CONTACT SETTINGS */}
          {activeTab === 'contacts' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                      <h3 className="font-black text-lg px-2">إدارة وسائل التواصل</h3>
                      <button onClick={() => setShowAddContact(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95">+ إضافة وسيلة تواصل</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {data.contacts.map(contact => (
                          <div key={contact.id} className={`glass-card p-6 rounded-[2.5rem] border transition-all ${!contact.isActive ? 'opacity-60 grayscale' : 'hover:shadow-xl'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-2xl">
                                          {contact.type === 'whatsapp' ? '💬' : contact.type === 'phone' ? '📞' : '✉️'}
                                      </div>
                                      <div>
                                          <h4 className="font-black text-sm capitalize">{contact.type === 'whatsapp' ? 'واتساب' : contact.type === 'phone' ? 'هاتف' : 'بريد إلكتروني'}</h4>
                                          <p className="text-[10px] font-bold text-slate-400">{contact.value}</p>
                                      </div>
                                  </div>
                                  <button 
                                      onClick={() => handleToggleContact(contact.id)} 
                                      className={`w-10 h-6 rounded-full relative transition-colors ${contact.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                  >
                                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${contact.isActive ? 'right-5' : 'right-1'}`} />
                                  </button>
                              </div>
                              <div className="flex gap-2 pt-4 border-t dark:border-white/5">
                                  <button onClick={() => { setContactForm({ type: contact.type, value: contact.value }); setShowEditContact(contact); setShowAddContact(true); }} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-100">تعديل</button>
                                  <button onClick={() => setDeleteTarget({ id: contact.id, name: contact.value, type: 'CONTACT' })} className="flex-1 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100">حذف</button>
                              </div>
                          </div>
                      ))}
                      {data.contacts.length === 0 && (
                          <div className="col-span-full text-center py-16 text-slate-400 font-bold border-2 border-dashed rounded-[2rem]">
                              لا توجد وسائل تواصل مضافة حالياً
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* 7. SETTINGS & BANK (UPDATED FOR MULTIPLE ACCOUNTS) */}

         {activeTab === 'settings' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4">
                 {/* Bank Accounts List */}
                 <div className="glass-card p-6 rounded-[3rem] border">
                     <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-2xl">🏦</div>
                            <div>
                                <h3 className="font-black text-lg">الحسابات البنكية</h3>
                                <p className="text-[9px] text-slate-400 font-bold">إدارة حسابات استلام الأرباح</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAddBank(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black hover:scale-105 transition-transform">+ حساب جديد</button>
                     </div>
                     
                     <div className="space-y-3">
                        {agentBankAccounts.length > 0 ? agentBankAccounts.map(bank => (
                            <div key={bank.id} className={`p-4 rounded-2xl border transition-all ${bank.isActive ? 'bg-slate-50 dark:bg-white/5 border-indigo-200 dark:border-indigo-900/50' : 'bg-slate-100 dark:bg-white/5 border-slate-200 opacity-60'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-black text-sm text-slate-800 dark:text-white">{bank.bankName}</h4>
                                        <p className="font-mono text-[10px] text-slate-500 font-bold">{bank.accountNumber}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleToggleBank(bank.id, bank.isActive)} 
                                        className={`w-10 h-5 rounded-full relative transition-colors ${bank.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${bank.isActive ? 'right-6' : 'right-1'}`} />
                                    </button>
                                </div>
                                <p className="text-[9px] text-slate-400 mb-3">{bank.accountHolder}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => { setBankForm(bank); setShowEditBank(bank); setShowAddBank(true); }} className="flex-1 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black hover:bg-indigo-100">تعديل</button>
                                    <button onClick={() => setDeleteTarget({id: bank.id, name: bank.bankName, type: 'BANK_ACCOUNT'})} className="flex-1 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black hover:bg-rose-100">حذف</button>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-slate-400 text-xs font-bold border-2 border-dashed rounded-2xl">
                                لا توجد حسابات بنكية مضافة
                            </div>
                        )}
                     </div>
                 </div>

                 {/* Security Config */}
                 <div className="glass-card p-8 rounded-[3rem] border text-center h-fit">
                     <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto text-3xl mb-6">🔐</div>
                     <h3 className="font-black text-lg mb-6">تحديث البيانات الأمنية</h3>
                     <div className="space-y-4">
                         <input type="password" placeholder="كلمة المرور الجديدة" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none" value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} />
                         <input type="password" placeholder="تأكيد كلمة المرور" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} />
                         <input type="text" placeholder="PIN Code" maxLength={4} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-center font-black tracking-[0.5em] outline-none" value={passwordForm.pin} onChange={e => setPasswordForm({...passwordForm, pin: e.target.value})} />
                         <button onClick={() => { if(passwordForm.new && passwordForm.new===passwordForm.confirm) { StorageService.updateUser(user.id, {password:passwordForm.new, pin:passwordForm.pin}); showNotification('تم التحديث ✅'); setPasswordForm({new:'', confirm:'', pin:passwordForm.pin}); } else showNotification('تحقق من البيانات', 'error'); }} className="w-full py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-xs shadow-xl active:scale-95 transition-all">حفظ التغييرات</button>
                     </div>
                 </div>
             </div>
         )}
      </div>

      {/* --- MODALS --- */}

      {/* Bank Account Modal (Add/Edit) */}
      {showAddBank && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="glass-card w-full max-w-sm p-8 rounded-[3rem] bg-white dark:bg-indigo-950 shadow-2xl space-y-4 animate-in zoom-in duration-300">
                <h3 className="text-lg font-black text-indigo-600 text-center border-b pb-3">{showEditBank ? 'تعديل الحساب البنكي' : 'إضافة حساب جديد'}</h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 px-2">اسم البنك / المحفظة</label>
                        <input type="text" placeholder="مثال: الكريمي / وان كاش" value={bankForm.bankName} onChange={e => setBankForm({...bankForm, bankName: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-slate-400 px-2">رقم الحساب / الجوال</label>
                        <input type="text" placeholder="رقم الحساب" value={bankForm.accountNumber} onChange={e => setBankForm({...bankForm, accountNumber: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold font-mono outline-none" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-slate-400 px-2">الاسم الرباعي للمستفيد</label>
                        <input type="text" placeholder="الاسم كما في الحساب البنكي" value={bankForm.accountHolder} onChange={e => setBankForm({...bankForm, accountHolder: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none" />
                    </div>
                </div>
                <div className="flex gap-2 pt-2">
                    <button onClick={closeModals} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-xs">إلغاء</button>
                    <button onClick={handleSaveBank} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg">{showEditBank ? 'حفظ التعديلات' : 'إضافة الحساب'}</button>
                </div>
             </div>
          </div>
      )}

      {/* Contact Modal (Add/Edit) */}
      {showAddContact && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="glass-card w-full max-w-sm p-8 rounded-[3rem] bg-white dark:bg-indigo-950 shadow-2xl space-y-4 animate-in zoom-in duration-300">
                <h3 className="text-lg font-black text-indigo-600 text-center border-b pb-3">{showEditContact ? 'تعديل وسيلة التواصل' : 'إضافة وسيلة تواصل'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 px-2">النوع</label>
                        <select 
                            value={contactForm.type} 
                            onChange={e => setContactForm({...contactForm, type: e.target.value as any})} 
                            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none"
                        >
                            <option value="whatsapp">واتساب</option>
                            <option value="phone">هاتف</option>
                            <option value="email">بريد إلكتروني</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-slate-400 px-2">القيمة (الرقم أو البريد)</label>
                        <input 
                            type="text" 
                            placeholder={contactForm.type === 'email' ? 'example@mail.com' : '967777777777'} 
                            value={contactForm.value} 
                            onChange={e => setContactForm({...contactForm, value: e.target.value})} 
                            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none" 
                        />
                    </div>
                </div>
                <div className="flex gap-2 pt-2">
                    <button onClick={closeModals} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-xs">إلغاء</button>
                    <button onClick={handleSaveContact} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg">{showEditContact ? 'حفظ التعديلات' : 'إضافة'}</button>
                </div>
             </div>
          </div>
      )}

      {/* Request Settlement Modal (Updated to select bank) */}
      {showRequestSettlement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-sm p-8 rounded-[3rem] bg-white dark:bg-indigo-950 shadow-2xl text-center space-y-4 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl mb-2">💰</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">تأكيد طلب السحب</h3>
                
                <div className="text-right">
                    <label className="text-[9px] font-black text-slate-400 px-2 block mb-1">اختر الحساب البنكي للاستلام</label>
                    <select 
                        value={selectedBankForSettlement} 
                        onChange={(e) => setSelectedBankForSettlement(e.target.value)}
                        className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs font-bold outline-none"
                    >
                        <option value="">-- اختر الحساب --</option>
                        {agentBankAccounts.filter(b => b.isActive).map(b => (
                            <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                        ))}
                    </select>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl">
                    <p className="text-[10px] text-emerald-600 font-bold mb-1">الرصيد المتاح</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{financials.availableBalance} ن</p>
                </div>
                
                <input type="number" placeholder="المبلغ المطلوب سحبه" value={settlementAmount} onChange={e => setSettlementAmount(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-center font-black text-lg outline-none focus:ring-2 ring-emerald-500/20" />
                
                <div className="flex gap-2">
                    <button onClick={closeModals} className="flex-1 py-4 bg-slate-100 rounded-[1.5rem] font-black text-xs">إلغاء</button>
                    <button onClick={handleRequestSettlement} className="flex-1 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs shadow-xl active:scale-95 transition-all">إرسال الطلب</button>
                </div>
            </div>
        </div>
      )}

      {/* Add/Edit Category Modal */}
      {(showAddCat || showEditCat) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-sm p-6 rounded-[2.5rem] bg-white dark:bg-indigo-950 shadow-2xl space-y-4 animate-in zoom-in duration-300">
                <h3 className="text-xl font-black text-center text-indigo-600 border-b pb-2">{showEditCat ? 'تعديل الفئة' : 'فئة جديدة'}</h3>
                <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 px-2">اسم الفئة</label>
                    <input type="text" placeholder="مثال: أبو ساعة" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold text-xs outline-none focus:border-indigo-500" />
                    
                    <label className="text-[9px] font-black text-slate-400 px-2">السعر بالنقاط (سعر البيع)</label>
                    <input type="number" placeholder="0" value={catForm.pointsPrice} onChange={e => setCatForm({...catForm, pointsPrice: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold text-xs outline-none focus:border-indigo-500" />
                    
                    <label className="text-[9px] font-black text-slate-400 px-2">حجم البيانات (اختياري)</label>
                    <input type="text" placeholder="مثال: 500 ميجا" value={catForm.dataSize} onChange={e => setCatForm({...catForm, dataSize: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold text-xs outline-none focus:border-indigo-500" />
                    
                    <label className="text-[9px] font-black text-slate-400 px-2">ملاحظات</label>
                    <textarea placeholder="ملاحظات إضافية" value={catForm.note} onChange={e => setCatForm({...catForm, note: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold text-xs h-24 resize-none outline-none focus:border-indigo-500" />
                </div>
                <div className="flex gap-2">
                    <button onClick={closeModals} className="flex-1 py-4 bg-slate-100 rounded-[1.5rem] font-black text-xs">إلغاء</button>
                    <button onClick={handleSaveCategory} disabled={isProcessing} className="flex-1 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs shadow-xl flex items-center justify-center">
                        {isProcessing ? 'جاري الحفظ...' : 'حفظ'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Add Cards Modal */}
      {showAddCards && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-sm p-6 rounded-[2.5rem] bg-white dark:bg-indigo-950 shadow-2xl space-y-4 animate-in zoom-in duration-300">
                <h3 className="text-xl font-black text-center text-emerald-600 border-b pb-2">إضافة كروت: {showAddCards.name}</h3>
                <div className="space-y-3">
                    <label className="block text-[9px] font-black text-slate-400">خيار 1: استيراد ملف نصي (.txt)</label>
                    <input type="file" accept=".txt" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => { if (ev.target?.result) setCardsForm(prev => prev + (prev ? '\n' : '') + ev.target.result); };
                            reader.readAsText(file);
                        }
                    }} className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    
                    <label className="block text-[9px] font-black text-slate-400 mt-2">خيار 2: نسخ ولصق الأكواد (كل كود في سطر)</label>
                    <textarea value={cardsForm} onChange={e => setCardsForm(e.target.value)} placeholder="12345678&#10;87654321&#10;..." className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-mono text-xs h-40 outline-none focus:border-indigo-500" />
                </div>
                <div className="flex gap-2">
                    <button onClick={closeModals} className="flex-1 py-4 bg-slate-100 rounded-[1.5rem] font-black text-xs">إلغاء</button>
                    <button onClick={handleAddCards} disabled={isProcessing} className="flex-1 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs shadow-xl flex items-center justify-center">
                        {isProcessing ? 'جاري المعالجة...' : 'إضافة الكروت'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* View Cards Modal */}
      {viewCardsCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="glass-card w-full max-w-2xl p-6 rounded-[3rem] bg-white dark:bg-indigo-950 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in duration-300">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="text-lg font-black text-indigo-900 dark:text-white">كروت: {viewCardsCategory.name}</h3>
                    <button onClick={() => setViewCardsCategory(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto overflow-x-auto max-h-[400px] no-scrollbar pr-1">
                    <table className="w-full text-right text-[10px] border-collapse">
                        <thead className="sticky top-0 bg-white dark:bg-indigo-950 z-10 font-black text-slate-400 border-b">
                            <tr>
                                <th className="py-3">الكود</th>
                                <th className="py-3">تاريخ الإضافة</th>
                                <th className="py-3">الحالة</th>
                                <th className="py-3 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredKroot.filter(k => k.categoryId === viewCardsCategory.id).map(k => (
                                <tr key={k.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                    <td className="py-3 font-mono text-indigo-600 font-bold">
                                        {revealedCards[k.id] ? StorageService.decryptCardCode(k.cardNumber) : '••••••••••••'}
                                        <button onClick={() => setRevealedCards({...revealedCards, [k.id]: !revealedCards[k.id]})} className="mr-2 opacity-30 hover:opacity-100">👁️</button>
                                    </td>
                                    <td className="py-3 opacity-60" dir="ltr">{k.createdAt ? new Date(k.createdAt).toLocaleString('ar-YE') : '-'}</td>
                                    <td className="py-3"><span className={`px-2 py-1 rounded text-[9px] font-bold ${k.status === CardStatus.AVAILABLE ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{k.status === CardStatus.AVAILABLE ? 'متاح' : 'مباع'}</span></td>
                                    <td className="py-3 flex justify-center gap-2">
                                        <button onClick={() => { navigator.clipboard.writeText(StorageService.decryptCardCode(k.cardNumber)); showNotification('تم النسخ'); }} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="نسخ">📋</button>
                                        <button onClick={() => setShowEditCard({id: k.id, code: StorageService.decryptCardCode(k.cardNumber)})} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="تعديل">✏️</button>
                                        <button onClick={() => handleArchiveCard(k.id)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="أرشفة">📦</button>
                                        <button onClick={() => handleDeleteCard(k.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100" title="حذف">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                            {data.kroot.filter(k => k.categoryId === viewCardsCategory.id).length === 0 && (
                                <tr><td colSpan={4} className="text-center py-8 text-slate-400 font-bold">لا توجد كروت في هذه الفئة</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* Edit Card Modal */}
      {showEditCard && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-xs p-6 rounded-[2.5rem] bg-white dark:bg-indigo-950 shadow-2xl space-y-4 animate-in zoom-in duration-300">
                <h3 className="text-lg font-black text-center text-indigo-600 border-b pb-2">تعديل رقم الكرت</h3>
                <input type="text" value={showEditCard.code} onChange={e => setShowEditCard({...showEditCard, code: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-mono font-bold text-xs outline-none focus:border-indigo-500" />
                <div className="flex gap-2">
                    <button onClick={() => setShowEditCard(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-xs">إلغاء</button>
                    <button onClick={handleUpdateCardCode} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-xl">حفظ</button>
                </div>
            </div>
        </div>
      )}

      {/* Print Confirmation Modal */}
      {showPrintConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass-card w-full max-w-xs p-8 rounded-[2.5rem] bg-white dark:bg-indigo-950 text-center space-y-4 animate-in zoom-in duration-200 border-2 border-slate-200 dark:border-white/10">
                <div className="w-20 h-20 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto text-4xl mb-2">🖨️</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">تأكيد الطباعة</h3>
                <p className="text-xs text-slate-500 font-bold">
                    هل أنت متأكد من تحميل تقرير المبيعات بصيغة PDF؟
                </p>
                <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowPrintConfirm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-xs">إلغاء</button>
                    <button onClick={confirmPrint} disabled={isGeneratingPDF} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-black text-xs shadow-xl active:scale-95 transition-all">
                        {isGeneratingPDF ? 'جاري التحميل...' : 'نعم، تحميل PDF ✅'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Handles all deletes) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass-card w-full max-w-xs p-8 rounded-[2.5rem] bg-white dark:bg-indigo-950 text-center space-y-4 animate-in zoom-in duration-200 border-2 border-rose-500/20">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-4xl mb-2">⚠️</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">تأكيد الحذف</h3>
                
                {deleteTarget.type === 'RESET_CATEGORY_CARDS' ? (
                     <p className="text-xs text-slate-500 font-bold">
                        هل أنت متأكد من حذف <span className="text-rose-600 font-black underline">جميع الكروت المتاحة</span> داخل فئة {deleteTarget.name}؟
                        <br/><span className="text-[10px] opacity-70">لن يتم حذف الكروت المباعة.</span>
                     </p>
                ) : deleteTarget.type === 'RESET_CATS' ? (
                     <p className="text-xs text-slate-500 font-bold">
                        هل أنت متأكد من حذف جميع الفئات والكروت المرتبطة بها؟
                        <br/><span className="text-[10px] opacity-70 text-rose-500">لا يمكن التراجع عن هذه العملية.</span>
                     </p>
                ) : (
                    <p className="text-xs text-slate-500 font-bold">
                        هل أنت متأكد من حذف <span className="text-rose-600 font-black underline">{deleteTarget.name}</span>؟
                        <br/><span className="text-[10px] opacity-70">لا يمكن التراجع عن هذه العملية!</span>
                    </p>
                )}

                {deleteTarget.type === 'CATEGORY' && <p className="text-[9px] text-rose-500 bg-rose-50 p-2 rounded-lg">تحذير: سيتم حذف جميع الكروت المتاحة فقط. الكروت المباعة ستبقى في الأرشيف.</p>}
                
                <div className="flex gap-2 pt-2">
                    <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-xs">تراجع</button>
                    <button onClick={handleResetAction} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-xs shadow-xl active:scale-95 transition-all">حذف نهائي</button>
                </div>
            </div>
        </div>
      )}

      </div>
      </main>
    </div>
  );
};

export default AgentDashboard;
