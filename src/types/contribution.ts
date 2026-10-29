/** Port types contribution từ Web (types/index.ts 676-755). */

export interface ContributionPolicy {
  post_weight: number;
  comment_weight: number;
  reaction_weight: number;
  event_weight: number;
  top_contributor_threshold: number;
  moderator_promotion_threshold: number;
  auto_promote_enabled: boolean;
  badge_enabled: boolean;
}

export interface ContributionSummary {
  user_id: string;
  display_name: string;
  avatar_uri: string;
  valid_posts: number;
  quality_comments: number;
  positive_reactions: number;
  event_participations: number;
  contribution_score: number;
  badge_type: string | null;
  promoted_to_mod: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_uri: string;
  contribution_score: number;
  badge_type: string | null;
}

export type ChallengeState = 'upcoming' | 'active' | 'ended' | 'cancelled';
export type ChallengeStatus = 'active' | 'completed' | 'cancelled';

export interface CommunityChallenge {
  id: string;
  community_id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  description: string;
  hashtag: string;
  points_per_post: number;
  start_date: string;
  end_date: string;
  max_participants?: number;
  status: string;
  state: ChallengeState;
  participants_count: number;
  joined: boolean;
  can_manage: boolean;
  daily_post_limit: number;
  daily_posts_awarded: number;
  created_at: string;
}

export interface ChallengeParticipant {
  user_id: string;
  display_name: string;
  avatar_uri: string;
  posts_count: number;
  total_points_earned: number;
  joined_at: string;
}

export interface CreateChallengePayload {
  title: string;
  description: string;
  hashtag: string;
  points_per_post: number;
  start_date: string;
  end_date: string;
  max_participants?: number;
}

export interface UpdateChallengePayload extends Partial<CreateChallengePayload> {
  status?: ChallengeStatus;
}
