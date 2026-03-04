import { 
  User, UserRole, Agent, Category, Card, CardStatus, 
  Order, Status, PointRequest, BankAccount, SettlementReport, AgentBankDetails,
  SystemSettings, AgentVisibleTabs, TabConfig, AgentTabsConfig,
  Loan, LuckyWheelPrize, FlashOffer, Transaction, Deposit,
  SupportTicket, TicketStatus
} from '../types';
import { googleSheetsService } from '../src/services/GoogleSheetsService';

const SECRET_KEY = 'QUANTUM_WIFI_ULTRA_SECURE_KEY_2025';
declare var CryptoJS: any;

const Security = {
  hashPassword: (password: string) => CryptoJS.SHA256(password + SECRET_KEY).toString(),
  encrypt: (text: string) => CryptoJS.AES.encrypt(text, SECRET_KEY).toString(),
  decrypt: (cipherText: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      return originalText || "ERROR_DEC";
    } catch (e) { return "ERROR_DEC"; }
  }
};

const STORAGE_KEYS = {
  USERS: 'qw_users_v2',
  CATEGORIES: 'qw_categories_v2',
  KROOT: 'qw_kroot_v2',
  ORDERS: 'qw_orders_v2',
  BANKS: 'qw_banks_v2',
  POINT_REQUESTS: 'qw_point_requests_v2',
  REPORTS: 'qw_reports_v2',
  ADMIN_AVATAR: 'qw_admin_avatar_v1',
  ADMIN_THEME: 'qw_admin_theme_v1',
  SYSTEM_LOGS: 'qw_system_logs_v1', 
  STAT_OFFSETS: 'qw_stat_offsets_v1',
  SYSTEM_SETTINGS: 'qw_system_settings',
  NOTIFICATIONS: 'qw_notifications_v1',
  LOANS: 'qw_loans_v1',
  LUCKY_WHEEL: 'qw_lucky_wheel_v1',
  FLASH_OFFERS: 'qw_flash_offers_v1',
  SUPPORT_TICKETS: 'qw_support_tickets_v1'
};

export interface SystemLog {
  id: string;
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
  type: 'RESET' | 'EDIT' | 'DELETE' | 'SYSTEM';
}

const getDB = <T,>(key: string, def: T): T => {
  const data = localStorage.getItem(key);
  try { return data ? JSON.parse(data) : def; } catch (e) { return def; }
};

const setDB = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

export const StorageService = {
  init: () => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    const adminPhone = '774578241';
    
    const adminIndex = users.findIndex(u => u.id === 'master_user' || u.phone === adminPhone);
    
    if (adminIndex === -1) {
      const newAdmin: User = { 
        id: 'master_user', 
        fullName: 'أحمد القدسي', 
        phone: adminPhone,
        password: Security.hashPassword('75486958'), 
        role: UserRole.ADMIN, 
        pointsBalance: 999999, 
        isActive: true, 
        status: 'ACTIVE', 
        createdAt: new Date().toISOString()
      };
      setDB(STORAGE_KEYS.USERS, [newAdmin, ...users]);
    } else {
      // Force update master admin credentials
      const admin = users[adminIndex];
      admin.phone = adminPhone;
      admin.password = Security.hashPassword('75486958');
      users[adminIndex] = admin;
      setDB(STORAGE_KEYS.USERS, users);
    }
  },

  resetSystem: () => {
    const master = getDB<User[]>(STORAGE_KEYS.USERS, []).find(u => u.id === 'master_user');
    const avatar = localStorage.getItem(STORAGE_KEYS.ADMIN_AVATAR);
    localStorage.clear();
    if (master) setDB(STORAGE_KEYS.USERS, [master]);
    if (avatar) localStorage.setItem(STORAGE_KEYS.ADMIN_AVATAR, avatar);
    StorageService.init();
    window.location.reload();
  },

  authenticate: async (identifier: string, pass: string): Promise<User | string> => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    const user = users.find(u => u.phone === identifier);
    if (!user) return "المستخدم غير موجود";
    if (user.password !== Security.hashPassword(pass)) return "كلمة المرور خاطئة";
    if (!user.isActive) return "الحساب معطل من قبل الإدارة.";
    return user;
  },

  updatePassword: (id: string, newPass: string) => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    setDB(STORAGE_KEYS.USERS, users.map(u => u.id === id ? { ...u, password: Security.hashPassword(newPass) } : u));
  },

  // --- Admin Profile & Logs ---
  getAdminAvatar: () => localStorage.getItem(STORAGE_KEYS.ADMIN_AVATAR),
  updateAdminAvatar: (base64: string) => localStorage.setItem(STORAGE_KEYS.ADMIN_AVATAR, base64),
  removeAdminAvatar: () => localStorage.removeItem(STORAGE_KEYS.ADMIN_AVATAR),

  getAdminTheme: () => localStorage.getItem(STORAGE_KEYS.ADMIN_THEME) || 'default',
  updateAdminTheme: (theme: string) => localStorage.setItem(STORAGE_KEYS.ADMIN_THEME, theme),

  // System Logs
  logAction: (action: string, details: string, performedBy: string, type: SystemLog['type'] = 'SYSTEM') => {
      const logs = getDB<SystemLog[]>(STORAGE_KEYS.SYSTEM_LOGS, []);
      const newLog: SystemLog = {
          id: `LOG-${Date.now()}`,
          action,
          details,
          performedBy,
          timestamp: new Date().toISOString(),
          type
      };
      setDB(STORAGE_KEYS.SYSTEM_LOGS, [newLog, ...logs].slice(0, 200)); 
      
      // Push to Google Sheets
      googleSheetsService.appendLog({
        id: newLog.id,
        user: newLog.performedBy,
        details: newLog.details,
        network: action,
        value: '-',
        date: newLog.timestamp,
        type: newLog.type,
        status: 'مكتمل'
      });

      // Periodically update stats
      StorageService.calculateAndPushStats();
  },

  calculateAndPushStats: async () => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    const orders = getDB<Order[]>(STORAGE_KEYS.ORDERS, []);
    const pointRequests = getDB<PointRequest[]>(STORAGE_KEYS.POINT_REQUESTS, []);
    const settlements = getDB<SettlementReport[]>(STORAGE_KEYS.REPORTS, []);
    const categories = getDB<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const allCards = getDB<Card[]>(STORAGE_KEYS.KROOT, []);

    const stats = {
      users_active: users.filter(u => u.role === UserRole.USER && u.isActive).length,
      users_total: users.filter(u => u.role === UserRole.USER).length,
      agents_active: users.filter(u => u.role === UserRole.AGENT && u.isActive).length,
      agents_total: users.filter(u => u.role === UserRole.AGENT).length,
      managers_active: users.filter(u => u.role === UserRole.MANAGER && u.isActive).length,
      managers_total: users.filter(u => u.role === UserRole.MANAGER).length,
      networks_count: new Set(users.filter(u => u.role === UserRole.AGENT).map(u => (u as Agent).networkName)).size,
      categories_count: categories.length,
      available_cards: allCards.filter(c => c.status === CardStatus.AVAILABLE).length,
      sold_cards: allCards.filter(c => c.status === CardStatus.SOLD).length,
      total_sales_points: orders.reduce((acc, o) => acc + o.pointsUsed, 0),
      agent_earnings: orders.reduce((acc, o) => acc + o.agentEarnings, 0),
      system_profit: orders.reduce((acc, o) => acc + o.masterProfit, 0),
      financial_operations: pointRequests.length + settlements.length,
      pending_deposits: pointRequests.filter(r => r.status === Status.PENDING).length,
      pending_settlements: settlements.filter(r => r.status === Status.PENDING).length,
      approved_requests: pointRequests.filter(r => r.status === Status.COMPLETED).length + settlements.filter(r => r.status === Status.PAID).length,
      rejected_requests: pointRequests.filter(r => r.status === Status.REJECTED).length + settlements.filter(r => r.status === Status.REJECTED).length,
    };

    await googleSheetsService.updateStats(stats);
  },
  getSystemLogs: () => getDB<SystemLog[]>(STORAGE_KEYS.SYSTEM_LOGS, []),

  getStatOffsets: () => getDB<Record<string, number>>(STORAGE_KEYS.STAT_OFFSETS, {}),
  setStatOffset: (key: string, value: number) => {
      const offsets = getDB<Record<string, number>>(STORAGE_KEYS.STAT_OFFSETS, {});
      setDB(STORAGE_KEYS.STAT_OFFSETS, { ...offsets, [key]: value });
  },

  // --- Core Getters ---
  getAgents: () => getDB<Agent[]>(STORAGE_KEYS.USERS, []).filter(u => u.role === UserRole.AGENT),
  getManagers: () => getDB<User[]>(STORAGE_KEYS.USERS, []).filter(u => u.role === UserRole.MANAGER || (u.role === UserRole.ADMIN && u.id !== 'master_user')),
  getUsers: () => getDB<User[]>(STORAGE_KEYS.USERS, []),
  getBankAccounts: () => getDB<BankAccount[]>(STORAGE_KEYS.BANKS, []),
  getAllCards: () => getDB<Card[]>(STORAGE_KEYS.KROOT, []),
  getCategories: (agentId?: string) => {
    const cats = getDB<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    return agentId ? cats.filter(c => c.agentId === agentId) : cats;
  },
  getOrders: (userId?: string, role?: UserRole) => {
    const orders = getDB<Order[]>(STORAGE_KEYS.ORDERS, []);
    if (role === UserRole.ADMIN || role === UserRole.MANAGER) return orders;
    return role === UserRole.AGENT ? orders.filter(o => o.agentId === userId) : orders.filter(o => o.userId === userId);
  },

  addAgent: (data: any) => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    const newAgent = { 
      ...data, id: `A-${Date.now()}`, role: UserRole.AGENT, 
      password: Security.hashPassword(data.password || '123456'), pointsBalance: 0, 
      isActive: true, status: 'ACTIVE', createdAt: new Date().toISOString() 
    };
    setDB(STORAGE_KEYS.USERS, [...users, newAgent]);
  },
  updateUser: (id: string, data: any) => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    setDB(STORAGE_KEYS.USERS, users.map(u => u.id === id ? { ...u, ...data, password: (data.password && data.password !== u.password) ? Security.hashPassword(data.password) : u.password } : u));
  },
  deleteUser: (id: string) => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    const filtered = users.filter(u => u.id !== id || u.id === 'master_user');
    setDB(STORAGE_KEYS.USERS, filtered);
  },

  // === Category & Cards Management ===
  addCategory: (data: any) => setDB(STORAGE_KEYS.CATEGORIES, [...getDB<Category[]>(STORAGE_KEYS.CATEGORIES, []), { ...data, id: `C-${Date.now()}` }]),
  updateCategory: (id: string, data: any) => {
    const cats = getDB<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    setDB(STORAGE_KEYS.CATEGORIES, cats.map(c => c.id === id ? { ...c, ...data } : c));
  },
  deleteCategory: (id: string) => {
    const cats = getDB<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    setDB(STORAGE_KEYS.CATEGORIES, cats.filter(c => c.id !== id));
    const kroot = getDB<Card[]>(STORAGE_KEYS.KROOT, []);
    setDB(STORAGE_KEYS.KROOT, kroot.filter(k => !(k.categoryId === id && k.status === CardStatus.AVAILABLE)));
  },
  addCards: (agentId: string, categoryId: string, codes: string[]) => {
    const allCards = getDB<Card[]>(STORAGE_KEYS.KROOT, []);
    const categories = getDB<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const agentCards = allCards.filter(c => c.agentId === agentId);
    
    // Decrypt existing cards for comparison
    const existingCodesMap = new Map<string, string>(); // code -> categoryName
    agentCards.forEach(c => {
      const decrypted = Security.decrypt(c.cardNumber);
      const cat = categories.find(cat => cat.id === c.categoryId);
      existingCodesMap.set(decrypted, cat?.name || 'فئة غير معروفة');
    });

    const newKroot: Card[] = [];
    const results = { added: 0, duplicates: [] as { code: string, category: string }[] };
    const batchSet = new Set<string>(); 

    codes.forEach(code => {
      const cleanCode = code.trim();
      if (!cleanCode) return;
      
      if (existingCodesMap.has(cleanCode)) {
        results.duplicates.push({ code: cleanCode, category: existingCodesMap.get(cleanCode)! });
        return;
      }
      
      if (batchSet.has(cleanCode)) {
        results.duplicates.push({ code: cleanCode, category: 'نفس الدفعة' });
        return;
      }

      batchSet.add(cleanCode);
      newKroot.push({
        id: `K-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        agentId, categoryId, cardNumber: Security.encrypt(cleanCode), status: CardStatus.AVAILABLE, createdAt: new Date().toISOString()
      } as any); 
      results.added++;
    });

    if (newKroot.length > 0) setDB(STORAGE_KEYS.KROOT, [...allCards, ...newKroot]);
    return results;
  },
  updateCardCode: (cardId: string, newCode: string) => {
    const allCards = getDB<Card[]>(STORAGE_KEYS.KROOT, []);
    setDB(STORAGE_KEYS.KROOT, allCards.map(c => c.id === cardId ? { ...c, cardNumber: Security.encrypt(newCode) } : c));
  },
  deleteCard: (cardId: string) => setDB(STORAGE_KEYS.KROOT, getDB<Card[]>(STORAGE_KEYS.KROOT, []).filter(c => c.id !== cardId)),
  archiveCard: (cardId: string) => setDB(STORAGE_KEYS.KROOT, getDB<Card[]>(STORAGE_KEYS.KROOT, []).map(c => c.id === cardId ? { ...c, status: CardStatus.ARCHIVED } : c)),
  restoreCard: (cardId: string) => setDB(STORAGE_KEYS.KROOT, getDB<Card[]>(STORAGE_KEYS.KROOT, []).map(c => c.id === cardId ? { ...c, status: CardStatus.AVAILABLE } : c)),

  // === Clear Functions ===
  clearAgentSales: (agentId: string) => setDB(STORAGE_KEYS.ORDERS, getDB<Order[]>(STORAGE_KEYS.ORDERS, []).filter(o => o.agentId !== agentId)),
  clearAgentStats: (agentId: string) => {}, // Logic unified in clearSales
  clearAgentCategories: (agentId: string) => {
     const cats = getDB<Category[]>(STORAGE_KEYS.CATEGORIES, []);
     const agentCatIds = cats.filter(c => c.agentId === agentId).map(c => c.id);
     setDB(STORAGE_KEYS.CATEGORIES, cats.filter(c => c.agentId !== agentId));
     setDB(STORAGE_KEYS.KROOT, getDB<Card[]>(STORAGE_KEYS.KROOT, []).filter(c => !(agentCatIds.includes(c.categoryId) && c.status === CardStatus.AVAILABLE)));
  },
  clearCategoryInventory: (agentId: string, categoryId: string) => {
     setDB(STORAGE_KEYS.KROOT, getDB<Card[]>(STORAGE_KEYS.KROOT, []).filter(c => !(c.agentId === agentId && c.categoryId === categoryId && c.status === CardStatus.AVAILABLE)));
  },
  clearAgentCards: (agentId: string) => { /* Implemented in categories */ },
  clearAgentArchive: (agentId: string) => setDB(STORAGE_KEYS.KROOT, getDB<Card[]>(STORAGE_KEYS.KROOT, []).filter(c => c.agentId !== agentId || c.status === CardStatus.AVAILABLE)),
  clearAgentSettlements: (agentId: string) => setDB(STORAGE_KEYS.REPORTS, getDB<SettlementReport[]>(STORAGE_KEYS.REPORTS, []).filter(r => r.agentId !== agentId)),

  // === Financials & Requests ===
  getPointsRequests: () => getDB<PointRequest[]>(STORAGE_KEYS.POINT_REQUESTS, []),
  createPointsRequest: (userId: string, userName: string, amount: number, method: string, ref: string, client: string) => setDB(STORAGE_KEYS.POINT_REQUESTS, [...getDB<PointRequest[]>(STORAGE_KEYS.POINT_REQUESTS, []), { id: `PR-${Date.now()}`, userId, userName, amount, paymentMethod: method, referenceNumber: ref, recipientName: client, status: Status.PENDING, createdAt: new Date().toISOString() }]),
  
  approvePoints: (requestId: string) => {
    const requests = getDB<PointRequest[]>(STORAGE_KEYS.POINT_REQUESTS, []);
    const req = requests.find(r => r.id === requestId);
    if (req && req.status === Status.PENDING) {
      const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
      setDB(STORAGE_KEYS.USERS, users.map(u => u.id === req.userId ? { ...u, pointsBalance: u.pointsBalance + req.amount } : u));
      setDB(STORAGE_KEYS.POINT_REQUESTS, requests.map(r => r.id === requestId ? { ...r, status: Status.COMPLETED } : r));
    }
  },
  
  updatePointsRequestStatus: (id: string, status: Status) => {
    const requests = getDB<PointRequest[]>(STORAGE_KEYS.POINT_REQUESTS, []);
    setDB(STORAGE_KEYS.POINT_REQUESTS, requests.map(r => r.id === id ? { ...r, status } : r));
  },
  
  // New Methods for Edit Request
  updatePointsRequestAmount: (id: string, newAmount: number) => {
      const requests = getDB<PointRequest[]>(STORAGE_KEYS.POINT_REQUESTS, []);
      setDB(STORAGE_KEYS.POINT_REQUESTS, requests.map(r => r.id === id ? { ...r, amount: newAmount } : r));
  },

  updateSettlementAmount: (id: string, newAmount: number) => {
      const reports = getDB<SettlementReport[]>(STORAGE_KEYS.REPORTS, []);
      setDB(STORAGE_KEYS.REPORTS, reports.map(r => r.id === id ? { ...r, agentEarnings: newAmount } : r));
  },

  getSettlementReports: () => getDB<SettlementReport[]>(STORAGE_KEYS.REPORTS, []),
  createSettlementRequest: (agentId: string, amount: number, bankId: string) => {
    const agent = getDB<Agent[]>(STORAGE_KEYS.USERS, []).find(u => u.id === agentId);
    if (!agent) throw new Error("وكيل غير موجود");
    let selectedBank: AgentBankDetails | undefined;
    if (agent.bankAccounts) selectedBank = agent.bankAccounts.find(b => b.id === bankId);
    else if (agent.savedBankDetails) selectedBank = agent.savedBankDetails;
    if (!selectedBank) throw new Error("يرجى اختيار حساب بنكي مفعل");

    const report: SettlementReport = {
      id: `REQ-${Date.now()}`, agentId, agentName: agent.fullName, networkName: agent.networkName,
      periodType: 'custom', startDate: new Date().toISOString(), endDate: new Date().toISOString(),
      totalOrders: 0, totalPoints: 0, masterProfit: 0, agentEarnings: amount, status: Status.PENDING, 
      orderIds: [], createdAt: new Date().toISOString(), totalSalesValue: 0, bankDetails: selectedBank
    };
    setDB(STORAGE_KEYS.REPORTS, [...getDB<SettlementReport[]>(STORAGE_KEYS.REPORTS, []), report]);
  },
  processSettlement: (id: string, status: Status, note: string) => {
    const reports = getDB<SettlementReport[]>(STORAGE_KEYS.REPORTS, []);
    setDB(STORAGE_KEYS.REPORTS, reports.map(r => r.id === id ? { ...r, status, processedAt: new Date().toISOString(), referenceNumber: status === Status.PAID ? note : r.referenceNumber, adminNotes: note } : r));
  },
  
  // ... (Other agent methods kept as is)
  getAgentData: (agentId: string) => ({
      categories: StorageService.getCategories(agentId),
      orders: StorageService.getOrders(agentId, UserRole.AGENT),
      kroot: getDB<Card[]>(STORAGE_KEYS.KROOT, []).filter(k => k.agentId === agentId)
  }),
  addAgentBankAccount: (agentId: string, bank: any) => {
      const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
      const newBank = { ...bank, id: `AB-${Date.now()}`, isActive: true };
      setDB(STORAGE_KEYS.USERS, users.map(u => u.id === agentId ? { ...u, bankAccounts: [...((u as Agent).bankAccounts || []), newBank] } : u));
  },
  updateAgentBankAccount: (agentId: string, bankId: string, updates: any) => {
      const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
      setDB(STORAGE_KEYS.USERS, users.map(u => u.id === agentId ? { ...u, bankAccounts: ((u as Agent).bankAccounts || []).map(b => b.id === bankId ? { ...b, ...updates } : b) } : u));
  },
  deleteAgentBankAccount: (agentId: string, bankId: string) => {
      const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
      setDB(STORAGE_KEYS.USERS, users.map(u => u.id === agentId ? { ...u, bankAccounts: ((u as Agent).bankAccounts || []).filter(b => b.id !== bankId) } : u));
  },

  // === Agent Contacts Management ===
  addAgentContact: (agentId: string, contact: any) => {
      const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
      const newContact = { ...contact, id: `AC-${Date.now()}`, isActive: true };
      setDB(STORAGE_KEYS.USERS, users.map(u => u.id === agentId ? { ...u, contacts: [...((u as Agent).contacts || []), newContact] } : u));
  },
  updateAgentContact: (agentId: string, contactId: string, updates: any) => {
      const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
      setDB(STORAGE_KEYS.USERS, users.map(u => u.id === agentId ? { ...u, contacts: ((u as Agent).contacts || []).map(c => c.id === contactId ? { ...c, ...updates } : c) } : u));
  },
  deleteAgentContact: (agentId: string, contactId: string) => {
      const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
      setDB(STORAGE_KEYS.USERS, users.map(u => u.id === agentId ? { ...u, contacts: ((u as Agent).contacts || []).filter(c => c.id !== contactId) } : u));
  },
  toggleAgentContact: (agentId: string, contactId: string) => {
      const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
      setDB(STORAGE_KEYS.USERS, users.map(u => u.id === agentId ? { ...u, contacts: ((u as Agent).contacts || []).map(c => c.id === contactId ? { ...c, isActive: !c.isActive } : c) } : u));
  },

  createOrder: async (userId: string, categoryId: string, qty: number): Promise<Order[] | string> => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    const user = users.find(u => u.id === userId);
    const category = getDB<Category[]>(STORAGE_KEYS.CATEGORIES, []).find(c => c.id === categoryId);
    const availableCards = getDB<Card[]>(STORAGE_KEYS.KROOT, []).filter(k => k.categoryId === categoryId && k.status === CardStatus.AVAILABLE);
    if (!user || !category || availableCards.length < qty) return "فشلت العملية: رصيد غير كافٍ أو مخزون غير متوفر.";
    if (user.pointsBalance < (category.pointsPrice * qty)) return "رصيدك غير كافٍ لإتمام هذه العملية.";
    const agent = users.find(u => u.id === category.agentId) as Agent;
    const masterProfitPerCard = category.pointsPrice * (agent.profitPercentage / 100);
    const agentEarningsPerCard = category.pointsPrice - masterProfitPerCard;
    const selectedCards = availableCards.slice(0, qty);
    const newOrders: Order[] = selectedCards.map(card => ({
      id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId, userPhone: user.phone, userName: user.fullName, 
      agentId: category.agentId, categoryId, cardId: card.id,
      networkName: agent.networkName, categoryName: category.name,
      pointsUsed: category.pointsPrice, status: Status.COMPLETED,
      createdAt: new Date().toISOString(), cardNumber: card.cardNumber,
      masterProfit: masterProfitPerCard, agentEarnings: agentEarningsPerCard,
      isSettled: false
    }));
    setDB(STORAGE_KEYS.KROOT, getDB<Card[]>(STORAGE_KEYS.KROOT, []).map(k => selectedCards.some(s => s.id === k.id) ? { ...k, status: CardStatus.SOLD, soldTo: userId, soldAt: new Date().toISOString() } : k));
    setDB(STORAGE_KEYS.ORDERS, [...getDB<Order[]>(STORAGE_KEYS.ORDERS, []), ...newOrders]);
    setDB(STORAGE_KEYS.USERS, users.map(u => u.id === userId ? { ...u, pointsBalance: u.pointsBalance - (category.pointsPrice * qty) } : u));
    return newOrders;
  },

  addBankAccount: (data: any) => setDB(STORAGE_KEYS.BANKS, [...getDB<BankAccount[]>(STORAGE_KEYS.BANKS, []), { ...data, id: `B-${Date.now()}`, isActive: true }]),
  updateBankAccount: (id: string, data: any) => {
    const banks = getDB<BankAccount[]>(STORAGE_KEYS.BANKS, []);
    setDB(STORAGE_KEYS.BANKS, banks.map(b => b.id === id ? { ...b, ...data } : b));
  },
  deleteBankAccount: (id: string) => setDB(STORAGE_KEYS.BANKS, getDB<BankAccount[]>(STORAGE_KEYS.BANKS, []).filter(b => b.id !== id)),
  decryptCardCode: (val: string) => Security.decrypt(val),
  registerUser: (data: any) => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    const newUser: User = { 
      ...data, 
      id: `U-${Date.now()}`, 
      pointsBalance: 0, 
      isActive: true, 
      status: 'ACTIVE', 
      createdAt: new Date().toISOString(), 
      password: Security.hashPassword(data.password)
    };
    setDB(STORAGE_KEYS.USERS, [...users, newUser]);
  },

  // === System Settings ===
  getDefaultAgentTabs: (): AgentTabsConfig => ({
    tabs: [
      { id: 'stats', label: 'الرئيسية', icon: '🏠', enabled: true },
      { id: 'categories', label: 'إدارة الفئات', icon: '🎫', enabled: true },
      { id: 'archive', label: 'الأرشيف', icon: '📂', enabled: true },
      { id: 'sales', label: 'المبيعات', icon: '💰', enabled: true },
      { id: 'settlements', label: 'التسويات', icon: '🏦', enabled: true },
      { id: 'contacts', label: 'وسائل التواصل', icon: '📱', enabled: true },
      { id: 'settings', label: 'الإعدادات', icon: '⚙️', enabled: true },
    ]
  }),

  getSystemSettings: (): SystemSettings => {
    const defaultSettings: SystemSettings = {
      maintenance: false,
      announcement: '',
      agentTabs: StorageService.getDefaultAgentTabs(),
      agentVisibleTabs: {
        stats: true,
        categories: true,
        archive: true,
        sales: true,
        settlements: true,
        contacts: true,
        settings: true,
      },
      support: {
        whatsapp: '967700000000'
      }
    };
    const saved = localStorage.getItem(STORAGE_KEYS.SYSTEM_SETTINGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // Ensure all default tabs exist in the saved settings
      const mergedTabs = [...defaultSettings.agentTabs.tabs];
      if (parsed.agentTabs && parsed.agentTabs.tabs) {
        parsed.agentTabs.tabs.forEach((savedTab: any) => {
          const index = mergedTabs.findIndex(t => t.id === savedTab.id);
          if (index !== -1) {
            mergedTabs[index] = { ...mergedTabs[index], ...savedTab };
          }
        });
      }

      return {
        ...defaultSettings,
        ...parsed,
        agentTabs: { tabs: mergedTabs },
        agentVisibleTabs: { ...defaultSettings.agentVisibleTabs, ...parsed.agentVisibleTabs }
      };
    }
    return defaultSettings;
  },

  saveSystemSettings: (settings: SystemSettings): void => {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_SETTINGS, JSON.stringify(settings));
  },

  updateAgentTabs: (newTabs: TabConfig[]): void => {
    const settings = StorageService.getSystemSettings();
    settings.agentTabs.tabs = newTabs;
    StorageService.saveSystemSettings(settings);
  },

  // === Notifications ===
  getNotifications: (userId?: string) => {
    const all = getDB<any[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    return userId ? all.filter(n => n.userId === userId || n.userId === 'all') : all;
  },

  addNotification: (userId: string | 'all', title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const all = getDB<any[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const newNotif = {
      id: `NOT-${Date.now()}`,
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString()
    };
    setDB(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...all]);
  },

  markNotificationRead: (id: string) => {
    const all = getDB<any[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    setDB(STORAGE_KEYS.NOTIFICATIONS, all.map(n => n.id === id ? { ...n, read: true } : n));
  },

  markAllNotificationsRead: (userId: string) => {
    const all = getDB<any[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    setDB(STORAGE_KEYS.NOTIFICATIONS, all.map(n => (n.userId === userId || n.userId === 'all') ? { ...n, read: true } : n));
  },

  // === Favorites & Deposits ===
  toggleFavorite: (userId: string, agentId: string) => {
    const users = StorageService.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const favorites = user.favorites || [];
    const isFavorite = favorites.includes(agentId);
    const newFavorites = isFavorite 
      ? favorites.filter(id => id !== agentId)
      : [...favorites, agentId];
      
    StorageService.updateUser(userId, { favorites: newFavorites });
  },

  getUserDeposits: (userId: string) => {
    return StorageService.getPointsRequests().filter(r => r.userId === userId);
  },

  getTransactions: (userId: string): Transaction[] => {
    const orders = StorageService.getOrders(userId, UserRole.USER);
    const deposits = StorageService.getUserDeposits(userId);
    const loans = StorageService.getLoans(userId);
    const prizes = StorageService.getLuckyWheelHistory(userId);
    
    // For transfers, we'd need a separate storage or log. 
    // For now, let's assume we can find them in system logs or just mock some if needed.
    // However, the user wants "بيانات حقيقية (محاكاة) من localStorage".
    // I should probably have a dedicated transfers storage.
    const transfers = getDB<any[]>('qw_transfers_v1', []);
    const userTransfers = transfers.filter(t => t.fromUserId === userId || t.toUserId === userId);

    const txs: Transaction[] = [
      ...orders.map(o => ({
        id: o.id,
        date: o.createdAt,
        type: 'purchase' as const,
        details: `شراء كرت: ${o.categoryName} (${o.networkName})`,
        amount: -o.pointsUsed,
        status: o.status
      })),
      ...deposits.map(d => ({
        id: d.id,
        date: d.createdAt,
        type: 'deposit' as const,
        details: `شحن رصيد عبر ${d.paymentMethod}`,
        amount: d.amount,
        status: d.status
      })),
      ...loans.map(l => ({
        id: l.id,
        date: l.createdAt,
        type: 'loan' as const,
        details: `طلب سلفة`,
        amount: l.amount,
        status: l.status
      })),
      ...prizes.map(p => ({
        id: p.id,
        date: p.createdAt,
        type: 'prize' as const,
        details: `جائزة عجلة الحظ: ${p.prize}`,
        amount: p.value,
        status: Status.COMPLETED
      })),
      ...userTransfers.map(t => ({
        id: t.id,
        date: t.date,
        type: (t.fromUserId === userId ? 'transfer_out' : 'transfer_in') as any,
        details: t.fromUserId === userId ? `تحويل إلى ${t.toPhone}` : `استلام من ${t.fromName}`,
        amount: t.fromUserId === userId ? -t.amount : t.amount,
        status: Status.COMPLETED
      }))
    ];

    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getReports: (userId: string) => {
    // Combine orders and deposits into a unified report format
    const orders = StorageService.getOrders().filter(o => o.userId === userId);
    const deposits = StorageService.getUserDeposits(userId);
    
    const reports = [
      ...orders.map(o => ({
        id: o.id,
        date: o.createdAt,
        type: 'شراء كرت',
        details: `${o.networkName} - ${o.categoryName}`,
        amount: -o.pointsUsed,
        status: o.status
      })),
      ...deposits.map(d => ({
        id: d.id,
        date: d.createdAt,
        type: 'شحن رصيد',
        details: `عبر ${d.paymentMethod}`,
        amount: d.amount,
        status: d.status
      }))
    ];
    
    return reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  logout: () => {
    localStorage.removeItem('qw_current_user');
  },

  updateAgentVisibleTabs: (tabs: Partial<AgentVisibleTabs>): void => {
    const settings = StorageService.getSystemSettings();
    settings.agentVisibleTabs = { ...settings.agentVisibleTabs, ...tabs };
    StorageService.saveSystemSettings(settings);
  },

  // === Loans ===
  getLoans: (userId?: string) => {
    const loans = getDB<Loan[]>(STORAGE_KEYS.LOANS, []);
    return userId ? loans.filter(l => l.userId === userId) : loans;
  },
  requestLoan: (userId: string, amount: number) => {
    const loans = getDB<Loan[]>(STORAGE_KEYS.LOANS, []);
    const users = StorageService.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return "المستخدم غير موجود";
    
    const newLoan: Loan = {
      id: `LOAN-${Date.now()}`,
      userId,
      amount,
      status: Status.PENDING,
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    setDB(STORAGE_KEYS.LOANS, [...loans, newLoan]);
    return true;
  },

  // === Lucky Wheel ===
  getLuckyWheelHistory: (userId?: string) => {
    const history = getDB<LuckyWheelPrize[]>(STORAGE_KEYS.LUCKY_WHEEL, []);
    return userId ? history.filter(h => h.userId === userId) : history;
  },
  spinLuckyWheel: (userId: string, prize: string, value: number) => {
    const history = getDB<LuckyWheelPrize[]>(STORAGE_KEYS.LUCKY_WHEEL, []);
    const users = StorageService.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return "المستخدم غير موجود";

    const newPrize: LuckyWheelPrize = {
      id: `PRIZE-${Date.now()}`,
      userId,
      prize,
      value,
      createdAt: new Date().toISOString()
    };
    
    setDB(STORAGE_KEYS.LUCKY_WHEEL, [newPrize, ...history]);
    StorageService.updateUser(userId, { 
      pointsBalance: user.pointsBalance + value,
      luckyWheelLastSpin: new Date().toISOString()
    });
    return newPrize;
  },

  // === Flash Offers ===
  getFlashOffers: () => getDB<FlashOffer[]>(STORAGE_KEYS.FLASH_OFFERS, []),
  addFlashOffer: (offer: Omit<FlashOffer, 'id'>) => {
    const offers = getDB<FlashOffer[]>(STORAGE_KEYS.FLASH_OFFERS, []);
    const newOffer = { ...offer, id: `FLASH-${Date.now()}` };
    setDB(STORAGE_KEYS.FLASH_OFFERS, [...offers, newOffer]);
  },

  // === Transfer Points ===
  transferPoints: (fromUserId: string, toPhone: string, amount: number) => {
    const users = StorageService.getUsers();
    const fromUser = users.find(u => u.id === fromUserId);
    const toUser = users.find(u => u.phone === toPhone);

    if (!fromUser) return "المستخدم المرسل غير موجود";
    if (!toUser) return "رقم هاتف المستلم غير موجود";
    if (fromUser.id === toUser.id) return "لا يمكنك التحويل لنفسك";
    if (fromUser.pointsBalance < amount) return "رصيدك غير كافٍ";

    StorageService.updateUser(fromUser.id, { pointsBalance: fromUser.pointsBalance - amount });
    StorageService.updateUser(toUser.id, { pointsBalance: toUser.pointsBalance + amount });

    // Record transfer
    const transfers = getDB<any[]>('qw_transfers_v1', []);
    transfers.push({
      id: `TR-${Date.now()}`,
      fromUserId,
      fromName: fromUser.fullName,
      toUserId: toUser.id,
      toPhone,
      amount,
      date: new Date().toISOString()
    });
    setDB('qw_transfers_v1', transfers);

    // Add to notifications for recipient
    StorageService.addNotification(toUser.id, 'استلام رصيد', `لقد استلمت ${amount} نقطة من ${fromUser.fullName}`, 'success');
    
    return true;
  },

  // === Support Tickets ===
  getSupportTickets: (userId?: string, role?: UserRole) => {
    const tickets = getDB<SupportTicket[]>(STORAGE_KEYS.SUPPORT_TICKETS, []);
    if (role === UserRole.ADMIN || role === UserRole.MANAGER) return tickets;
    if (role === UserRole.AGENT) return tickets.filter(t => t.recipientId === userId);
    return tickets.filter(t => t.userId === userId);
  },

  createSupportTicket: (ticket: Omit<SupportTicket, 'id' | 'status' | 'createdAt'>) => {
    const tickets = getDB<SupportTicket[]>(STORAGE_KEYS.SUPPORT_TICKETS, []);
    const newTicket: SupportTicket = {
      ...ticket,
      id: `TICKET-${Date.now()}`,
      status: TicketStatus.OPEN,
      createdAt: new Date().toISOString(),
      replies: []
    };
    setDB(STORAGE_KEYS.SUPPORT_TICKETS, [newTicket, ...tickets]);
    return newTicket;
  },

  updateTicketStatus: (ticketId: string, status: TicketStatus) => {
    const tickets = getDB<SupportTicket[]>(STORAGE_KEYS.SUPPORT_TICKETS, []);
    setDB(STORAGE_KEYS.SUPPORT_TICKETS, tickets.map(t => t.id === ticketId ? { ...t, status } : t));
  },

  addTicketReply: (ticketId: string, reply: { senderId: string, senderName: string, message: string }) => {
    const tickets = getDB<SupportTicket[]>(STORAGE_KEYS.SUPPORT_TICKETS, []);
    setDB(STORAGE_KEYS.SUPPORT_TICKETS, tickets.map(t => t.id === ticketId ? { 
      ...t, 
      replies: [...(t.replies || []), { ...reply, createdAt: new Date().toISOString() }] 
    } : t));
  }
};
StorageService.init();