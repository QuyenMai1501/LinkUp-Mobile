import { request } from './client';
import type { AdPackage, SubscriptionResponse } from '@/types/partner';
import type {
  PaymentMethodsResponse,
  WalletPurchaseResult,
} from '@/types/wallet';

export const getPackages = async (): Promise<AdPackage[]> => {
  const res = await request<{ data: AdPackage[] }>('/ads/packages');
  return res.data ?? [];
};

/**
 * Gói hiện tại — server 404 `package.NOT_SUBSCRIBED` khi chưa từng đăng ký;
 * caller bắt lỗi và hiển thị trạng thái "chưa có gói".
 */
export const getMySubscription = async (): Promise<SubscriptionResponse> => {
  const res = await request<{ data: SubscriptionResponse }>(
    '/ads-management/subscription',
  );
  return res.data;
};

export const getPaymentMethods = async (): Promise<PaymentMethodsResponse> => {
  const res = await request<{ data: PaymentMethodsResponse }>(
    '/ads-management/payment-methods',
  );
  return res.data;
};

/**
 * Mua gói bằng ví. Gói được kích hoạt ngay trong cùng transaction.
 * `idempotencyKey` phải giữ nguyên khi retry cùng một lần mua.
 */
export const createWalletPayment = (
  packageId: string,
  idempotencyKey: string,
): Promise<WalletPurchaseResult> =>
  request<WalletPurchaseResult>('/ads-management/payments/wallet', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ package_id: packageId }),
  });

export function newPaymentRequestId(): string {
  const cryptoApi = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
