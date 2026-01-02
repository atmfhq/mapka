import { useState, useEffect } from 'react';
import { Heart, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface Profile {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  avatar_config: AvatarConfig | null;
  tags: string[] | null;
  bio: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface EntityCommentsProps {
  entityType: 'shout' | 'spot';
  entityId: string;
  currentUserId: string | null;
  comments: Comment[];
  onAddComment: (userId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  getLikes: (commentId: string) => { count: number; hasLiked: boolean };
  toggleLike: (commentId: string) => void;
  onViewUserProfile?: (profile: Profile) => void;
}

const EntityComments = ({
  entityType,
  entityId,
  currentUserId,
  comments,
  onAddComment,
  onDeleteComment,
  getLikes,
  toggleLike,
  onViewUserProfile,
}: EntityCommentsProps) => {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentProfiles, setCommentProfiles] = useState<Record<string, Profile>>({});

  // Fetch comment author profiles
  useEffect(() => {
    if (comments.length === 0) return;

    const uniqueUserIds = [...new Set(comments.map(c => c.user_id))];
    
    const fetchProfiles = async () => {
      const { data } = await supabase.rpc('get_public_profiles_by_ids', { user_ids: uniqueUserIds });
      if (data) {
        const profilesMap: Record<string, Profile> = {};
        data.forEach((p: any) => {
          profilesMap[p.id] = {
            id: p.id,
            nick: p.nick,
            avatar_url: p.avatar_url,
            avatar_config: p.avatar_config as AvatarConfig,
            tags: p.tags,
            bio: p.bio,
            location_lat: p.location_lat,
            location_lng: p.location_lng,
          };
        });
        setCommentProfiles(profilesMap);
      }
    };

    fetchProfiles();
  }, [comments]);

  const handleSubmitComment = async () => {
    if (!currentUserId || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(currentUserId, newComment);
      setNewComment('');
    } catch (error: any) {
      toast({
        title: 'Failed to post comment',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await onDeleteComment(commentId);
    } catch (error: any) {
      toast({
        title: 'Failed to delete comment',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarClick = (userId: string) => {
    if (!onViewUserProfile) return;
    const profile = commentProfiles[userId];
    if (profile) {
      onViewUserProfile(profile);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-nunito font-semibold text-sm text-foreground">
        Comments ({comments.length})
      </h4>

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const profile = commentProfiles[comment.user_id];
            const commentLikes = getLikes(comment.id);
            const isOwn = comment.user_id === currentUserId;

            return (
              <div key={comment.id} className="flex gap-2">
                {/* Clickable avatar */}
                {onViewUserProfile ? (
                  <button
                    onClick={() => handleAvatarClick(comment.user_id)}
                    className="hover:opacity-80 transition-opacity shrink-0"
                  >
                    <AvatarDisplay config={profile?.avatar_config || null} size={28} />
                  </button>
                ) : (
                  <AvatarDisplay config={profile?.avatar_config || null} size={28} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {onViewUserProfile ? (
                      <button
                        onClick={() => handleAvatarClick(comment.user_id)}
                        className="font-nunito text-xs font-medium text-foreground hover:underline"
                      >
                        {profile?.nick || 'Anonymous'}
                      </button>
                    ) : (
                      <span className="font-nunito text-xs font-medium text-foreground">
                        {profile?.nick || 'Anonymous'}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 mt-0.5 break-words">
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => currentUserId && toggleLike(comment.id)}
                      disabled={!currentUserId}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                        commentLikes.hasLiked
                          ? 'bg-red-500/20 text-red-500'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      <Heart className={`w-3 h-3 ${commentLikes.hasLiked ? 'fill-current' : ''}`} />
                      {commentLikes.count > 0 && <span>{commentLikes.count}</span>}
                    </button>
                    {isOwn && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comment input */}
      {currentUserId && (
        <div className="flex gap-2 pt-2">
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, 200))}
            className="min-h-[40px] max-h-[80px] resize-none bg-muted/50 border-border text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleSubmitComment}
            disabled={isSubmitting || !newComment.trim()}
            className="shrink-0 bg-accent hover:bg-accent/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default EntityComments;