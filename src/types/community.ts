import type { FeedPost } from './post';

export type CommunityPrivacy = 'public' | 'invitation_only';

/**
 * Trạng thái quan hệ của user với cộng đồng.
 * Server trả: none | pending | member | creator (admin ≠ creator dùng
 * user_member_role = GROUP_ADMIN để nhận diện — xem isCommunityPrivileged).
 * 'admin' giữ trong union để phòng server mở rộng + statusOverride nội bộ.
 */
export type MembershipStatus = 'none' | 'pending' | 'member' | 'admin' | 'creator';

export type CommunityRole = 'COMMUNITY_ADMIN' | 'GROUP_ADMIN' | 'GROUP_MOD' | 'GROUP_MEMBER';

export type RuleCategory = 'conduct' | 'prohibited' | 'guidelines';

export interface CommunityListItem {
  id: string;
  name: string;
  description: string;
  avatar_uri: string;
  background_uri: string;
  privacy: CommunityPrivacy;
  member_count: number;
  is_creator: boolean;
  created_at: string;
}

export interface CommunityListResponse {
  communities: CommunityListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CommunityDetail {
  id: string;
  name: string;
  description: string;
  avatar_uri: string;
  background_uri: string;
  creator_id: string;
  creator_name: string;
  privacy: CommunityPrivacy;
  auto_approve: boolean;
  member_count: number;
  membership_status: MembershipStatus;
  user_member_role?: CommunityRole;
  created_at: string;
}

export interface CommunityMember {
  user_id: string;
  display_name: string;
  avatar_uri: string;
  role: CommunityRole;
  joined_at: string;
  contribution_score: number;
  badge_type?: string | null;
}

export interface CommunityRule {
  id: string;
  community_id: string;
  category: RuleCategory;
  title: string;
  content: string;
  position: number;
  created_at: string;
  updated_at?: string;
}

export interface CommunityJoinRequest {
  id: string;
  user_id: string;
  display_name: string;
  avatar_uri: string;
  status: 'pending';
  created_at: string;
}

export interface CommunityInviteCode {
  id: string;
  code: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** POST /communities/:id/join — có request_id nghĩa là chờ duyệt (pending). */
export interface JoinCommunityResponse {
  message: string;
  request_id?: string;
}

export interface CreateCommunityResponse {
  message: string;
  community_id: string;
  auto_approve: boolean;
  default_group_chat?: { id: string; name: string };
  invite_code?: string;
}

export interface CommunityPostsResponse {
  posts: FeedPost[];
}

/** Quản trị member: đổi vai trò chỉ nhận 3 giá trị này (server binding enum). */
export type ManageableRole = Extract<CommunityRole, 'GROUP_ADMIN' | 'GROUP_MOD' | 'GROUP_MEMBER'>;

/** Admin (privilege) = creator hoặc có vai trò admin — quản lý tab/thao tác admin. */
export function isCommunityPrivileged(
  status: MembershipStatus,
  role?: CommunityRole,
): boolean {
  return (
    status === 'creator' ||
    status === 'admin' ||
    role === 'COMMUNITY_ADMIN' ||
    role === 'GROUP_ADMIN'
  );
}
