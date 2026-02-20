
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
  password?: string;
  role: UserRole;
  pointsBalance: number;
  isActive: boolean;
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  createdAt: string;
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

export interface MikroTikConfig {
  host: string;
  port: string;
  username: string;
  password?: string;
  mode: 'MANUAL' | 'AUTO';
}
