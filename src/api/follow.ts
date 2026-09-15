import { request } from './client';

import type {
  FollowStats,
  FollowToggleResponse,
  FollowListResponse,
  MutualFriendsResponse,
} from '../types/profile';

export const getFollowStats = (userId: string) =>
  request<FollowStats>(`/follow/stats/${userId}`);

export const followUser = (userId: string) =>
  request<FollowToggleResponse>(`/follow/${userId}`, {
    method: 'POST',
  });

export const getFollowers = (userId: string, page = 1, pageSize = 20) =>
  request<FollowListResponse>(
    `/follow/${userId}/followers?page=${page}&page_size=${pageSize}`,
  );

export const getFollowing = (userId: string, page = 1, pageSize = 20) =>
  request<FollowListResponse>(
    `/follow/${userId}/following?page=${page}&page_size=${pageSize}`,
  );

export const getMutualFriends = (userId: string) =>
  request<MutualFriendsResponse>(`/follow/${userId}/mutual`);
