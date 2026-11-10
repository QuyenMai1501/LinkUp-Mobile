import { request } from './client';
import type { PaymentListResponse } from '@/types/wallet';

export interface PaymentListParams {
  page?: number;
  page_size?: number;
  status?: string;
  gateway?: string;
}

export const getMyPayments = (
  params: PaymentListParams = {},
): Promise<PaymentListResponse> => {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.page_size) sp.set('page_size', String(params.page_size));
  if (params.status) sp.set('status', params.status);
  if (params.gateway) sp.set('gateway', params.gateway);
  const qs = sp.toString();
  return request<PaymentListResponse>(
    `/ads-management/payments${qs ? `?${qs}` : ''}`,
  );
};
