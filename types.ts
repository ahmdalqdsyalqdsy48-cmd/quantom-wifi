
export enum UserRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  USER = 'USER',
  MANAGER = 'MANAGER'
}

export enum Status {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  CLOSED = 'CLOSED'
}

export enum CardStatus {
  AVAILABLE = 'AVAILABLE',
  SOLD = 'SOLD',
  ARCHIVED = 'ARCHIVED'
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  title: string;
  message: string;
  recipientType: 'ADMIN' | 'AGENT';
  recipientId?: string; // Agent ID if recipientType is AGENT
  recipientName: string; // "الإدارة العامة" or Agent Network Name
  status: TicketStatus;
  createdAt: string;
  replies?: {
    senderId: string;
    senderName: string;
    message: string;
    createdAt: string;
  }[];
}

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  password?: string;
  role: UserRole;
  pointsBalance: number;
  isActive: boolean;
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  createdAt: string;
  favorites?: string[]; // Array of Agent IDs
  referralCode?: string;
  referredBy?: string;
  loanBalance?: number;
  luckyWheelLastSpin?: string;
}

export interface AgentContact {
  id: string;
  type: 'whatsapp' | 'phone' | 'email';
  value: string;
  isActive: boolean;
}

export interface AgentBankDetails {
  id: string; // Unique ID for the bank account
  bankName: string; // نوع الحساب (بنك، محفظة، إلخ)
  accountNumber: string;
  accountHolder: string; // الاسم الرباعي
  isActive: boolean;
}

export interface Agent extends User {
  networkName: string;
  profitPercentage: number;
  microtikConfig?: MikroTikConfig;
  pin: string;
  bankAccounts?: AgentBankDetails[]; // قائمة الحسابات البنكية المتعددة
  contacts?: AgentContact[]; // وسائل التواصل
  // Legacy support field (optional)
  savedBankDetails?: AgentBankDetails; 
}

export interface SettlementReport {
  id: string;
  agentId: string;
  agentName: string;
  networkName: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  startDate: string;
  endDate: string;
  totalOrders: number; // يمكن أن يكون 0 إذا كان طلب رصيد عام
  totalPoints: number; // لم يعد أساسياً في الحساب الجديد
  masterProfit: number;
  agentEarnings: number; // المبلغ المطلوب تسويته
  status: Status;
  orderIds: string[];
  createdAt: string;
  bankDetails: AgentBankDetails; // البيانات التي تم الطلب عليها
  totalSalesValue: number;
  referenceNumber?: string; // رقم المرجع البنكي
  adminNotes?: string; // ملاحظات الإدارة / سبب الرفض
  processedAt?: string; // تاريخ التنفيذ
}

export interface Category {
  id: string;
  agentId: string;
  name: string;
  pointsPrice: number;
  dataSize: string;
  note: string;
  isActive: boolean;
}

export interface Card {
  id: string;
  cardNumber: string; // Encrypted
  categoryId: string;
  agentId: string;
  status: CardStatus;
  createdAt?: string; // تاريخ إضافة الكرت
  soldTo?: string;
  soldAt?: string;
}

export interface Order {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  agentId: string;
  categoryId: string;
  cardId: string;
  networkName: string;
  categoryName: string;
  pointsUsed: number;
  status: Status;
  createdAt: string;
  cardNumber: string; // Encrypted
  masterProfit: number;
  agentEarnings: number;
  isSettled: boolean;
  settlementReportId?: string;
}

export interface PointRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  recipientName: string;
  status: Status;
  createdAt: string;
}

export interface Deposit extends PointRequest {}

export interface Transaction {
  id: string;
  date: string;
  type: 'purchase' | 'deposit' | 'transfer_in' | 'transfer_out' | 'loan' | 'prize';
  details: string;
  amount: number;
  balanceAfter?: number;
  status: Status;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive: boolean;
}

export interface AgentVisibleTabs {
  stats: boolean;      // الرئيسية
  categories: boolean; // إدارة الفئات
  archive: boolean;    // الأرشيف
  sales: boolean;      // المبيعات
  settlements: boolean; // التسويات
  contacts: boolean;    // وسائل التواصل
  settings: boolean;   // الإعدادات
}

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}

export interface AgentTabsConfig {
  tabs: TabConfig[];
}

export interface SystemSettings {
  maintenance: boolean;
  announcement: string;
  agentTabs: AgentTabsConfig;
  agentVisibleTabs?: AgentVisibleTabs;
  support?: {
    whatsapp: string;
  };
}

export interface MikroTikConfig {
  host: string;
  port: string;
  username: string;
  password?: string;
  mode: 'MANUAL' | 'AUTO';
}

export interface Loan {
  id: string;
  userId: string;
  amount: number;
  status: Status;
  createdAt: string;
  dueDate: string;
}

export interface LuckyWheelPrize {
  id: string;
  userId: string;
  prize: string;
  value: number;
  createdAt: string;
}

export interface FlashOffer {
  id: string;
  categoryId: string;
  discountPercentage: number;
  expiresAt: string;
  isActive: boolean;
}
