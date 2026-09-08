import { request } from './client';

import type {
  FriendActionResponse,
  FriendListResponse,
  FriendRequestListResponse,
  FriendSuggestionsResponse,
} from '../types/friend';

export const getFriends = (page = 1, pageSize = 20) =>
  request<FriendListResponse>(`/friends?page=${page}&page_size=${pageSize}`);

export const getFriendSuggestions = (page = 1, pageSize = 20) =>
  request<FriendSuggestionsResponse>(`/friends/suggestions?page=${page}&page_size=${pageSize}`);

export const getFriendRequests = () =>
  request<FriendRequestListResponse>('/friend-requests');

export const toggleFriendRequest = (userId: string) =>
  request<FriendActionResponse>(`/friend-requests/${userId}`, {
    method: 'POST',
  });

export const acceptFriendRequest = (id: string) =>
  request<FriendActionResponse>(`/friend-requests/${id}/accept`, {
    method: 'PUT',
  });

export const rejectFriendRequest = (id: string) =>
  request<FriendActionResponse>(`/friend-requests/${id}`, {
    method: 'DELETE',
  });

export const unfriend = (userId: string) =>
  request<FriendActionResponse>(`/friends/${userId}`, {
    method: 'DELETE',
  });
