import type { TokenResponse } from './auth';
import type { SubscriptionResponse } from './partner';

export interface PaymentMethodOption {
  key: 'wallet' | 'momo' | 'vnpay' | string;
  enabled: boolean;
}

export interface PaymentMethodsResponse {
  methods: PaymentMethodOption[];
  default: string;
}

export interface CreatePaymentResponse {
  payment_url: string;
  txn_ref: string;
  amount: number;
  expires_at: string;
}

export interface PaymentTransaction {
  id: string;
  txn_ref: string;
  user_id: string;
  package_id: string;
  amount: number;
  status: string;
  gateway: string;
  response_code?: string;
  created_at: string;
  paid_at?: string;
  package?: {
    id: string;
    name: string;
    max_slots?: number;
    max_duration_days?: number;
  };
}

export interface PaymentListResponse {
  data: PaymentTransaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface WalletResponse {
  balance: number;
  reserved: number;
  available: number;
  currency: string;
  total_topup: number;
  total_spent: number;
}

export interface WalletBalance {
  balance: number;
  reserved: number;
  available: number;
  currency: string;
}

export interface WalletPurchaseResponse {
  subscription: SubscriptionResponse;
  payment: PaymentTransaction;
  wallet?: WalletBalance;
  replayed: boolean;
}

export interface WalletPurchaseResult {
  message: string;
  data: WalletPurchaseResponse;
  tokens?: TokenResponse;
}

export type WalletTopupStatus =
  | 'pending'
  | 'paid'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface WalletTopup {
  id: string;
  code: string;
  amount: number;
  status: WalletTopupStatus;
  expires_at: string;
  user_reported_at?: string;
  proof_url?: string;
  confirmed_amount?: number;
  admin_note?: string;
  paid_at?: string;
  created_at: string;
}

export interface WalletTopupListResponse {
  data: WalletTopup[];
  total: number;
  page: number;
  page_size: number;
}

export interface WalletBankInfo {
  bank_name: string;
  bank_bin: string;
  account_no: string;
  account_name: string;
}

export interface WalletTopupCreated {
  id: string;
  code: string;
  amount: number;
  status: WalletTopupStatus;
  expires_at: string;
  expires_in_seconds: number;
  qr_url: string;
  bank: WalletBankInfo;
  memo: string;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  reserved_after: number;
  ref_type?: string;
  ref_id?: string;
  note?: string;
  created_at: string;
}

export interface WalletTransactionListResponse {
  data: WalletTransaction[];
  total: number;
  page: number;
  page_size: number;
}
