import { request } from './client';
import type { AdPackage, SubscribeResult, SubscriptionResponse } from '@/types/partner';

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

/** Đăng ký gói — response kèm `tokens` khi server tái phát hành (nâng role PARTNER). */
export const subscribePackage = (packageId: string): Promise<SubscribeResult> =>
  request<SubscribeResult>('/ads-management/subscribe', {
    method: 'POST',
    body: JSON.stringify({ package_id: packageId }),
  });
