import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Heart, X, Send, Trash2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useShoutLikes, useShoutCommentLikes } from '@/hooks/useShoutLikes';
import { useShoutComments, type ShoutComment } from '@/hooks/useShoutComments';
import { formatDistanceToNow } from 'date-fns';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface Shout {
  id: string;
  user_id: string;
  content: string;
  lat: number;
  lng: number;
  created_at: string;
}

interface ShoutDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shout: Shout | null;
  currentUserId: string | null;
}

const ShoutDetailsDrawer = ({ isOpen, onClose, shout, currentUserId }: ShoutDetailsDrawerProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [authorProfile, setAuthorProfile] = useState<{ nick: string | null; avatar_config: AvatarConfig | null } | null>(null);
  const [commentProfiles, setCommentProfiles] = useState<Record<string, { nick: string | null; avatar_config: AvatarConfig | null }>>({});

  // Handle share functionality
  const handleShare = async () => {
    if (!shout) return;
    
    const shareUrl = `${window.location.origin}/?shoutId=${shout.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied!',
        description: 'Share this link with others to show them this shout.',
      });
    } catch (error) {
      // Fallback for older browsers
      toast({
        title: 'Share link',
        description: shareUrl,
      });
    }
  };

  // Handle guest login prompt
  const handleGuestAction = () => {
    navigate('/auth');
  };

  // Hooks for likes and comments
  const shoutIds = useMemo(() => shout ? [shout.id] : [], [shout?.id]);
  const { getLikes: getShoutLikes, toggleLike: toggleShoutLike } = useShoutLikes(shoutIds, currentUserId);
  const { comments, addComment, deleteComment } = useShoutComments(shout?.id || null);
  
  const commentIds = useMemo(() => comments.map(c => c.id), [comments]);
  const { getLikes: getCommentLikes, toggleLike: toggleCommentLike } = useShoutCommentLikes(commentIds, currentUserId);

  // Fetch author profile
  useEffect(() => {
    if (!shout) return;

    const fetchAuthor = async () => {
      const { data } = await supabase.rpc('get_public_profile', { p_user_id: shout.user_id });
      if (data && data[0]) {
        setAuthorProfile({
          nick: data[0].nick,
          avatar_config: data[0].avatar_config as AvatarConfig,
        });
      }
    };

    fetchAuthor();
  }, [shout?.user_id]);

  // Fetch comment author profiles
  useEffect(() => {
    if (comments.length === 0) return;

    const uniqueUserIds = [...new Set(comments.map(c => c.user_id))];
    
    const fetchProfiles = async () => {
      const { data } = await supabase.rpc('get_public_profiles_by_ids', { user_ids: uniqueUserIds });
      if (data) {
        const profilesMap: Record<string, { nick: string | null; avatar_config: AvatarConfig | null }> = {};
        data.forEach((p: any) => {
          profilesMap[p.id] = {
            nick: p.nick,
            avatar_config: p.avatar_config as AvatarConfig,
          };
        });
        setCommentProfiles(profilesMap);
      }
    };

    fetchProfiles();
  }, [comments]);

  const handleSubmitComment = async () => {
    if (!currentUserId || !newComment.trim() || !shout) return;

    setIsSubmitting(true);
    try {
      await addComment(currentUserId, newComment);
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
      await deleteComment(commentId);
    } catch (error: any) {
      toast({
        title: 'Failed to delete comment',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteShout = async () => {
    if (!shout || !currentUserId || shout.user_id !== currentUserId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('shouts')
        .delete()
        .eq('id', shout.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      toast({
        title: 'Shout deleted',
        description: 'Your shout has been removed.',
      });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Failed to delete shout',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatRemainingTime = () => {
    if (!shout) return '';
    const createdTime = new Date(shout.created_at).getTime();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const remainingMs = Math.max(0, twentyFourHours - (now - createdTime));
    
    if (remainingMs === 0) return 'expired';
    
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) return `${hours}h left`;
    return `${minutes}m left`;
  };

  if (!isOpen || !shout) return null;

  const shoutLikes = getShoutLikes(shout.id);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" style={{ isolation: 'isolate' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-transparent"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative bg-card border-2 border-border rounded-t-2xl sm:rounded-2xl shadow-hard w-full sm:max-w-md max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300 z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-nunito font-bold text-foreground">Shout</h3>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(shout.created_at), { addSuffix: true })} • {formatRemainingTime()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="rounded-lg hover:bg-muted"
              title="Share shout"
            >
              <Share2 className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="rounded-lg hover:bg-muted"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
            {/* Main shout */}
            <div className="space-y-3">
              {/* Author */}
              <div className="flex items-center gap-2">
                <AvatarDisplay config={authorProfile?.avatar_config || null} size={32} />
                <span className="font-nunito text-sm font-medium text-foreground">
                  {authorProfile?.nick || 'Anonymous'}
                </span>
              </div>

              {/* Content */}
              <p className="text-sm text-foreground leading-relaxed">
                {shout.content}
              </p>


              {/* Like button and Delete button */}
              <div className="flex items-center gap-2">
                {currentUserId ? (
                  <button
                    onClick={() => toggleShoutLike(shout.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                      shoutLikes.hasLiked
                        ? 'bg-red-500/20 text-red-500 border border-red-500/40'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted border border-border/50'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${shoutLikes.hasLiked ? 'fill-current' : ''}`} />
                    <span className="font-medium">{shoutLikes.count}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGuestAction}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors bg-muted/60 text-muted-foreground hover:bg-muted border border-border/50"
                  >
                    <Heart className="w-4 h-4" />
                    <span className="font-medium">{shoutLikes.count}</span>
                  </button>
                )}

                {/* Delete button - only visible to shout author */}
                {currentUserId && shout.user_id === currentUserId && (
                  <button
                    onClick={handleDeleteShout}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="font-medium">{isDeleting ? 'Deleting...' : 'Delete'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Comments section */}
            <div className="pt-4 border-t border-border space-y-3">
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
                    const commentLikes = getCommentLikes(comment.id);
                    const isOwn = comment.user_id === currentUserId;

                    return (
                      <div key={comment.id} className="flex gap-2">
                        <AvatarDisplay config={profile?.avatar_config || null} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-nunito text-xs font-medium text-foreground">
                              {profile?.nick || 'Anonymous'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/90 mt-0.5 break-words">
                            {comment.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => currentUserId && toggleCommentLike(comment.id)}
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
            </div>
          </div>
        </ScrollArea>

        {/* Comment input */}
        {currentUserId ? (
          <div className="p-4 border-t border-border shrink-0">
            <div className="flex gap-2">
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
          </div>
        ) : (
          <div className="p-4 border-t border-border shrink-0">
            <Button
              onClick={handleGuestAction}
              className="w-full bg-primary hover:bg-primary/90"
            >
              Login to join the conversation
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Use portal to render at document body level, ensuring highest z-index
  return createPortal(modalContent, document.body);
};

export default ShoutDetailsDrawer;
