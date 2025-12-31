import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FollowStats {
  followersCount: number;
  followingCount: number;
}

export const useFollows = (currentUserId: string | null, targetUserId?: string) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<FollowStats>({ followersCount: 0, followingCount: 0 });

  // Check if current user follows target user
  const checkFollowStatus = useCallback(async () => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      setIsFollowing(false);
      return;
    }

    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    setIsFollowing(!!data);
  }, [currentUserId, targetUserId]);

  // Get follower/following counts for a user
  const fetchStats = useCallback(async (userId: string) => {
    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    setStats({
      followersCount: followersResult.count || 0,
      followingCount: followingResult.count || 0,
    });
  }, []);

  // Follow a user
  const follow = async (userIdToFollow: string) => {
    if (!currentUserId || currentUserId === userIdToFollow) return false;

    setLoading(true);
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: currentUserId, following_id: userIdToFollow });

    setLoading(false);

    if (error) {
      console.error('Failed to follow:', error);
      return false;
    }

    setIsFollowing(true);
    setStats(prev => ({ ...prev, followersCount: prev.followersCount + 1 }));
    return true;
  };

  // Unfollow a user
  const unfollow = async (userIdToUnfollow: string) => {
    if (!currentUserId) return false;

    setLoading(true);
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', userIdToUnfollow);

    setLoading(false);

    if (error) {
      console.error('Failed to unfollow:', error);
      return false;
    }

    setIsFollowing(false);
    setStats(prev => ({ ...prev, followersCount: Math.max(0, prev.followersCount - 1) }));
    return true;
  };

  // Initial fetch
  useEffect(() => {
    if (targetUserId) {
      checkFollowStatus();
      fetchStats(targetUserId);
    }
  }, [targetUserId, checkFollowStatus, fetchStats]);

  // Realtime subscription
  useEffect(() => {
    if (!targetUserId) return;

    const channel = supabase
      .channel(`follows-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `following_id=eq.${targetUserId}`,
        },
        () => {
          checkFollowStatus();
          fetchStats(targetUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId, checkFollowStatus, fetchStats]);

  return {
    isFollowing,
    loading,
    stats,
    follow,
    unfollow,
    refetch: () => {
      if (targetUserId) {
        checkFollowStatus();
        fetchStats(targetUserId);
      }
    },
  };
};

// Helper hook to get just follower count for a user
export const useFollowerCount = (userId: string | null) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const fetchCount = async () => {
      const { count: followersCount } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId);

      setCount(followersCount || 0);
    };

    fetchCount();

    // Realtime updates
    const channel = supabase
      .channel(`follower-count-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `following_id=eq.${userId}`,
        },
        fetchCount
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
};
