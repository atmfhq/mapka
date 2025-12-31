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

// Hook to get list of users the current user is following
interface FollowedUser {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  avatar_config: {
    skinColor?: string;
    shape?: string;
    eyes?: string;
    mouth?: string;
  } | null;
  bio: string | null;
}

export const useFollowingList = (currentUserId: string | null) => {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowing = useCallback(async () => {
    if (!currentUserId) {
      setFollowing([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Get the list of user IDs the current user is following
    const { data: followsData, error: followsError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    if (followsError || !followsData || followsData.length === 0) {
      setFollowing([]);
      setLoading(false);
      return;
    }

    const followingIds = followsData.map(f => f.following_id);

    // Fetch profiles for those users
    const { data: profiles, error: profilesError } = await supabase
      .rpc('get_public_profiles_by_ids', { user_ids: followingIds });

    if (profilesError) {
      console.error('Failed to fetch following profiles:', profilesError);
      setFollowing([]);
      setLoading(false);
      return;
    }

    const followedUsers: FollowedUser[] = (profiles || []).map((p: any) => ({
      id: p.id,
      nick: p.nick,
      avatar_url: p.avatar_url,
      avatar_config: p.avatar_config,
      bio: p.bio,
    }));

    setFollowing(followedUsers);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchFollowing();
  }, [fetchFollowing]);

  // Realtime subscription for follows changes
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`following-list-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${currentUserId}`,
        },
        () => fetchFollowing()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchFollowing]);

  const unfollowUser = async (userIdToUnfollow: string) => {
    if (!currentUserId) return false;

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', userIdToUnfollow);

    if (error) {
      console.error('Failed to unfollow:', error);
      return false;
    }

    // Optimistically remove from list
    setFollowing(prev => prev.filter(u => u.id !== userIdToUnfollow));
    return true;
  };

  return { following, loading, refetch: fetchFollowing, unfollowUser };
};

// Hook to get list of users who follow the current user
export interface FollowerUser {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  avatar_config: {
    skinColor?: string;
    shape?: string;
    eyes?: string;
    mouth?: string;
  } | null;
  bio: string | null;
}

export const useFollowersList = (currentUserId: string | null) => {
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowers = useCallback(async () => {
    if (!currentUserId) {
      setFollowers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Get the list of user IDs who follow the current user
    const { data: followsData, error: followsError } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', currentUserId);

    if (followsError || !followsData || followsData.length === 0) {
      setFollowers([]);
      setLoading(false);
      return;
    }

    const followerIds = followsData.map(f => f.follower_id);

    // Fetch profiles for those users
    const { data: profiles, error: profilesError } = await supabase
      .rpc('get_public_profiles_by_ids', { user_ids: followerIds });

    if (profilesError) {
      console.error('Failed to fetch followers profiles:', profilesError);
      setFollowers([]);
      setLoading(false);
      return;
    }

    const followerUsers: FollowerUser[] = (profiles || []).map((p: any) => ({
      id: p.id,
      nick: p.nick,
      avatar_url: p.avatar_url,
      avatar_config: p.avatar_config,
      bio: p.bio,
    }));

    setFollowers(followerUsers);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchFollowers();
  }, [fetchFollowers]);

  // Realtime subscription for follows changes
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`followers-list-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `following_id=eq.${currentUserId}`,
        },
        () => fetchFollowers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchFollowers]);

  return { followers, loading, refetch: fetchFollowers };
};
