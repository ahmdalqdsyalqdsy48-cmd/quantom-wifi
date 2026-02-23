
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

export enum CardStatus {
  AVAILABLE = 'AVAILABLE',
  SOLD = 'SOLD',
  ARCHIVED = 'ARCHIVED'
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  role: UserRole;
  pointsBalance: number;
  isActive: boolean;
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  createdAt: string;
  favorites?: string[]; // Array of Agent IDs
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
  userEmail: string;
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
  settings: boolean;   // الإعدادات
}

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}

export type ContentType = 'text' | 'html' | 'table' | 'cards' | 'stats' | 'builtin' | 'user_summary' | 'full_transactions' | 'purchases_only' | 'deposits_only' | 'networks_summary' | 'recent_activities' | 'dashboard' | 'user_wallet' | 'transactions_list' | 'purchased_cards' | 'favorite_networks' | 'notifications' | 'support' | 'reports';

export interface DynamicTab {
  id: string;               // معرف فريد (مثل 'tab_1623456789')
  label: string;            // اسم التبويب
  icon: string;             // أيقونة (إيموجي أو نص)
  contentType: ContentType; // نوع المحتوى
  content: any;             // المحتوى حسب النوع (نص، HTML، مصفوفة، الخ)
  enabled: boolean;
  order: number;            // الترتيب
}

export interface AgentTabsConfig {
  tabs: TabConfig[];
}

export interface UserTabsConfig {
  tabs: DynamicTab[];
}

export interface ActionButton {
  id: string;
  label: string;
  icon?: string;
  actionType: 'openModal' | 'navigate' | 'export' | 'custom';
  actionData?: any; // e.g., { modal: 'points' }, { tab: 'transactions' }
}

export interface SubTab {
  id: string;
  label: string;
  icon?: string;
  contentType: ContentType;
  content?: any;
  buttons?: ActionButton[];
  enabled: boolean;
  order: number;
}

export interface MainSection {
  id: string;
  label: string;
  icon: string;
  subTabs: SubTab[];
  enabled: boolean;
  order: number;
}

export interface UserDashboardLayout {
  sections: MainSection[];
}

export interface SystemSettings {
  maintenance: boolean;
  announcement: string;
  agentTabs: AgentTabsConfig;
  userTabs: UserTabsConfig;
  dashboardLayout?: UserDashboardLayout;
  agentVisibleTabs?: AgentVisibleTabs;
  support?: {
    whatsapp: string;
    email: string;
  };
}

export interface MikroTikConfig {
  host: string;
  port: string;
  username: string;
  password?: string;
  mode: 'MANUAL' | 'AUTO';
}
