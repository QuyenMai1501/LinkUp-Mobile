import { request } from './client';
import type {
  WalletResponse,
  WalletTopup,
  WalletTopupCreated,
  WalletTopupListResponse,
  WalletTransactionListResponse,
} from '@/types/wallet';

export const getWallet = async (): Promise<WalletResponse> => {
  const res = await request<{ data: WalletResponse }>('/wallet');
  return res.data;
};

export const listWalletTransactions = (page = 1, pageSize = 20) =>
  request<WalletTransactionListResponse>(
    `/wallet/transactions?page=${page}&page_size=${pageSize}`,
  );

export const listTopups = (page = 1, pageSize = 20) =>
  request<WalletTopupListResponse>(
    `/wallet/topups?page=${page}&page_size=${pageSize}`,
  );

export const createTopup = async (amount: number): Promise<WalletTopupCreated> => {
  const res = await request<{ message: string; data: WalletTopupCreated }>(
    '/wallet/topups',
    {
      method: 'POST',
      body: JSON.stringify({ amount }),
    },
  );
  return res.data;
};

export const reportTopup = async (
  id: string,
  proofUrl: string,
): Promise<WalletTopup> => {
  const res = await request<{ message: string; data: WalletTopup }>(
    `/wallet/topups/${id}/report`,
    {
      method: 'POST',
      body: JSON.stringify({ proof_url: proofUrl }),
    },
  );
  return res.data;
};

export const cancelTopup = (id: string) =>
  request<{ message: string }>(`/wallet/topups/${id}/cancel`, {
    method: 'POST',
  });
