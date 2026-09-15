import { useCallback, useEffect, useState } from 'react';

import { getFollowStats, followUser } from '@/api/follow';
import type { FollowStats } from '@/types/profile';

export function useFollowStats(userId: string | null) {
  const [stats, setStats] = useState<FollowStats | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getFollowStats(userId)
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setFollowing(data.is_following ?? false);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleFollow = useCallback(async () => {
    if (!userId || followBusy) return;
    setFollowBusy(true);

    const prevFollowing = following;
    const prevCount = stats?.follower_count ?? 0;

    setFollowing(!prevFollowing);
    setStats((s) =>
      s
        ? { ...s, follower_count: s.follower_count + (prevFollowing ? -1 : 1) }
        : s,
    );

    try {
      const res = await followUser(userId);
      setFollowing(res.is_following);
      setStats((s) =>
        s
          ? { ...s, follower_count: res.follower_count, following_count: res.following_count }
          : s,
      );
    } catch {
      setFollowing(prevFollowing);
      setStats((s) =>
        s ? { ...s, follower_count: prevCount } : s,
      );
    } finally {
      setFollowBusy(false);
    }
  }, [userId, followBusy, following, stats]);

  return { stats, following, followBusy, handleFollow };
}
