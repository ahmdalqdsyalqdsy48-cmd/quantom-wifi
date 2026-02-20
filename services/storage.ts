import { 
  User, UserRole, Agent, Category, Card, CardStatus, 
  Order, Status, PointRequest, BankAccount, SettlementReport, AgentBankDetails
} from '../types';

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
  STAT_OFFSETS: 'qw_stat_offsets_v1'
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
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      const master = { 
        id: 'master_user', fullName: 'أحمد القدسي', email: 'ahmdalqdsyalqdsy48@gmail.com', 
        password: Security.hashPassword('admin'), role: UserRole.ADMIN, pointsBalance: 999999, isActive: true, status: 'ACTIVE', createdAt: new Date().toISOString()
      };
      setDB(STORAGE_KEYS.USERS, [master]);
    }
  },

  resetSystem: () => {
    const master = getDB<User[]>(STORAGE_KEYS.USERS, []).find(u => u.email === 'ahmdalqdsyalqdsy48@gmail.com');
    const avatar = localStorage.getItem(STORAGE_KEYS.ADMIN_AVATAR);
    localStorage.clear();
    if (master) setDB(STORAGE_KEYS.USERS, [master]);
    if (avatar) localStorage.setItem(STORAGE_KEYS.ADMIN_AVATAR, avatar);
    StorageService.init();
    window.location.reload();
  },

  authenticate: async (email: string, pass: string): Promise<User | string> => {
    const users = getDB<User[]>(STORAGE_KEYS.USERS, []);
    const user = users.find(u => u.email === email);
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
  },
  getSystemLogs: () => getDB<SystemLog[]>(STORAGE_KEYS.SYSTEM_LOGS, []),

  getStatOffsets: () => getDB<Record<string, number>>(STORAGE_KEYS.STAT_OFFSETS, {}),
  setStatOffset: (key: string, value: number) => {
      const offsets = getDB<Record<string, number>>(STORAGE_KEYS.STAT_OFFSETS, {});
      setDB(STORAGE_KEYS.STAT_OFFSETS, { ...offsets, [key]: value });
  },

  // --- Core Getters ---
  getAgents: () => getDB<Agent[]>(STORAGE_KEYS.USERS, []).filter(u => u.role === UserRole.AGENT),
  getManagers: () => getDB<User[]>(STORAGE_KEYS.USERS, []).filter(u => u.role === UserRole.MANAGER || (u.role === UserRole.ADMIN && u.email !== 'ahmdalqdsyalqdsy48@gmail.com')),
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
    const filtered = users.filter(u => u.id !== id || u.email === 'ahmdalqdsyalqdsy48@gmail.com');
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
    const newKroot: Card[] = [];
    const results = { added: 0, duplicates: [] as string[] };
    const batchSet = new Set<string>(); // Optimize local check

    codes.forEach(code => {
      const cleanCode = code.trim();
      if (!cleanCode || batchSet.has(cleanCode)) return; 
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
      userId, userEmail: user.email, userName: user.fullName, 
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
  registerUser: (data: any) => setDB(STORAGE_KEYS.USERS, [...getDB<User[]>(STORAGE_KEYS.USERS, []), { ...data, id: `U-${Date.now()}`, pointsBalance: 0, isActive: true, status: 'ACTIVE', createdAt: new Date().toISOString(), password: Security.hashPassword(data.password) }])
};
StorageService.init();