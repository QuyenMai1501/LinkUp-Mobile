import { request } from './client';

export interface Place {
  id: string;
  name: { vi: string; en: string };
}

export const getProvinces = async (): Promise<Place[]> => {
  const res = await request<{ data: Place[] } | Place[]>(
    '/locations/provinces',
  );
  return Array.isArray(res) ? res : res.data ?? [];
};
