import { request } from './client';
import type {
  ChallengeParticipant,
  CommunityChallenge,
  ContributionPolicy,
  ContributionSummary,
  CreateChallengePayload,
  LeaderboardEntry,
  UpdateChallengePayload,
} from '@/types/contribution';

/** Port api/contribution.ts từ Web — endpoints contribution của community. */

interface PagedResponse<T> {
  page: number;
  page_size: number;
  data: T[];
}

export const getContributionPolicy = (communityID: string) =>
  request<{ data: ContributionPolicy }>(`/communities/${communityID}/policy`);

export const updateContributionPolicy = (communityID: string, data: ContributionPolicy) =>
  request<{ message: string }>(`/communities/${communityID}/policy`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getLeaderboard = (communityID: string, page = 1, pageSize = 20) =>
  request<PagedResponse<LeaderboardEntry>>(
    `/communities/${communityID}/contributions/leaderboard?page=${page}&page_size=${pageSize}`,
  );

export const getMyContribution = (communityID: string) =>
  request<{ data: ContributionSummary }>(`/communities/${communityID}/contributions/me`);

export const listChallenges = (communityID: string, includeEnded = true) =>
  request<{ data: CommunityChallenge[] }>(
    `/communities/${communityID}/challenges${includeEnded ? '?include_ended=true' : ''}`,
  );

export const getChallenge = (communityID: string, challengeID: string) =>
  request<{ data: CommunityChallenge }>(`/communities/${communityID}/challenges/${challengeID}`);

export const createChallenge = (communityID: string, data: CreateChallengePayload) =>
  request<{ message: string }>(`/communities/${communityID}/challenges`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateChallenge = (
  communityID: string,
  challengeID: string,
  data: UpdateChallengePayload,
) =>
  request<{ message: string; data: CommunityChallenge }>(
    `/communities/${communityID}/challenges/${challengeID}`,
    { method: 'PATCH', body: JSON.stringify(data) },
  );

export const joinChallenge = (communityID: string, challengeID: string) =>
  request<{ message: string }>(`/communities/${communityID}/challenges/${challengeID}/join`, {
    method: 'POST',
  });

export const getChallengeParticipants = (communityID: string, challengeID: string) =>
  request<{ data: ChallengeParticipant[] }>(
    `/communities/${communityID}/challenges/${challengeID}/participants`,
  );
