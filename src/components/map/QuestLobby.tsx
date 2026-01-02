import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, isToday } from 'date-fns';
import { Clock, Users, Trash2, UserPlus, X, Lock, Pencil, Save, CalendarIcon, LogIn, Hourglass, LogOut, Share2, ExternalLink, MapPin, Crown, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSpotBans } from '@/hooks/useSpotBans';
import { useSpotComments, useSpotCommentLikes } from '@/hooks/useSpotComments';
import EntityComments from '@/components/map/EntityComments';
import EmojiPicker from '@/components/ui/EmojiPicker';
import ProfileModal from './ProfileModal';

interface Quest {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  start_time: string;
  duration_minutes: number;
  max_participants: number | null;
  lat: number;
  lng: number;
  host_id: string;
  is_private?: boolean;
  share_code?: string;
  // Official event fields
  is_official?: boolean;
  cover_image_url?: string | null;
  organizer_display_name?: string | null;
  external_link?: string | null;
  location_details?: string | null;
}

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface Profile {
  id: string;
  nick: string;
  avatar_url: string;
  avatar_config: AvatarConfig | null;
  bio: string;
  tags: string[];
  location_lat?: number | null;
  location_lng?: number | null;
}

interface Participant {
  id: string;
  user_id: string;
  status: string;
  chat_active: boolean;
  is_chat_banned?: boolean;
  profile?: Profile;
}

interface QuestLobbyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quest: Quest | null;
  currentUserId: string | null;
  onDelete: () => void;
  onJoin?: (questId: string) => void;
  onLeave?: (questId: string) => void;
  onUpdate?: (quest: Quest) => void;
  onViewUserProfile?: (user: Profile) => void;
  isUserInViewport?: (lat: number, lng: number) => boolean;
}

// Simple helper to check if a string is an emoji (starts with emoji character)
const isEmoji = (str: string): boolean => {
  if (!str) return false;
  const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;
  return emojiRegex.test(str);
};

const getMinTimeForToday = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const minutes = Math.ceil(now.getMinutes() / 5) * 5;
  now.setMinutes(minutes);
  const hours = now.getHours().toString().padStart(2, '0');
  const mins = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
};

const QuestLobby = ({ 
  open, 
  onOpenChange, 
  quest, 
  currentUserId,
  onDelete,
  onJoin,
  onLeave,
  onUpdate,
  onViewUserProfile,
  isUserInViewport
}: QuestLobbyProps) => {
  const navigate = useNavigate();
  const [host, setHost] = useState<Profile | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  
  // Profile modal state - for viewing profiles on top of this modal
  const [selectedProfileForModal, setSelectedProfileForModal] = useState<Profile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  
  // Spot bans hook - only used for checking ban status on join
  const { checkIfBanned } = useSpotBans(
    quest?.id || null,
    quest?.host_id === currentUserId
  );

  // Spot comments hooks
  const { comments, addComment, deleteComment } = useSpotComments(quest?.id || null);
  const commentIds = useMemo(() => comments.map(c => c.id), [comments]);
  const { getLikes: getCommentLikes, toggleLike: toggleCommentLike } = useSpotCommentLikes(commentIds, currentUserId);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState<Date>();
  const [editTime, setEditTime] = useState('18:00');
  const [editDuration, setEditDuration] = useState(2);
  const [editIcon, setEditIcon] = useState<string>('');

  const MAX_VISIBLE_AVATARS = 5;
  const isGuest = !currentUserId;
  const isHost = quest?.host_id === currentUserId;

  // Handle viewing a profile - opens modal on top without closing quest lobby
  const handleViewProfileInModal = (profile: Profile) => {
    setSelectedProfileForModal(profile);
    setProfileModalOpen(true);
  };

  // Filter out host from participants to avoid duplication
  const filteredParticipants = useMemo(() => {
    if (!quest) return [];
    return participants.filter(p => p.user_id !== quest.host_id);
  }, [participants, quest]);

  // Calculate min time based on selected date
  const minTime = useMemo(() => {
    if (!editDate) return undefined;
    if (isToday(editDate)) {
      return getMinTimeForToday();
    }
    return undefined;
  }, [editDate]);

  // Initialize edit form when entering edit mode
  const startEditing = () => {
    if (!quest) return;
    
    const startTime = new Date(quest.start_time);
    
    setEditTitle(quest.title);
    setEditDescription(quest.description || '');
    setEditDate(startTime);
    setEditTime(format(startTime, 'HH:mm'));
    setEditDuration(quest.duration_minutes / 60);
    setEditIcon(quest.category || '');
    
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditIcon('');
  };

  // Fetch host profile and participants (using anonymous-friendly function)
  useEffect(() => {
    if (!quest) return;
    
    setIsEditing(false);

    const fetchData = async () => {
      const { data: hostProfiles } = await supabase
        .rpc('get_profiles_display', { user_ids: [quest.host_id] });
      
      const hostData = hostProfiles?.[0];
      
      if (hostData) setHost(hostData as Profile);

      const { data: participantsData } = await supabase
        .from('event_participants')
        .select('id, user_id, status, chat_active, is_chat_banned')
        .eq('event_id', quest.id);

      if (participantsData) {
        const userIds = participantsData.map(p => p.user_id);
        const { data: profiles } = await supabase
          .rpc('get_profiles_display', { user_ids: userIds });

        const participantsWithProfiles = participantsData.map(p => ({
          ...p,
          profile: profiles?.find(pr => pr.id === p.user_id) as Profile | undefined,
        }));

        setParticipants(participantsWithProfiles);
        const currentParticipant = participantsData.find(p => p.user_id === currentUserId);
        setHasJoined(!!currentParticipant);
      }
    };

    fetchData();
  }, [quest, currentUserId]);

  const refreshParticipants = async () => {
    if (!quest) return;
    
    const { data } = await supabase
      .from('event_participants')
      .select('id, user_id, status, chat_active, is_chat_banned')
      .eq('event_id', quest.id);
    
    if (data) {
      const userIds = data.map(p => p.user_id);
      const { data: profiles } = await supabase
        .rpc('get_profiles_display', { user_ids: userIds });

      const participantsWithProfiles = data.map(p => ({
        ...p,
        profile: profiles?.find(pr => pr.id === p.user_id) as Profile | undefined,
      }));

      setParticipants(participantsWithProfiles);
    }
  };

  const handleJoin = async () => {
    if (!quest || !currentUserId) return;
    setLoading(true);

    // Check if user is banned from this spot
    const isBanned = await checkIfBanned(quest.id, currentUserId);
    if (isBanned) {
      setLoading(false);
      toast({
        title: "You have been banned from this event",
        description: "The organizer has restricted your access.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from('event_participants').insert({
      event_id: quest.id,
      user_id: currentUserId,
      status: 'joined',
      chat_active: true,
    });

    if (error) {
      setLoading(false);
      toast({
        title: "Failed to join",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Auto-follow the event host if not already following
    let followedHost = false;
    if (quest.host_id !== currentUserId) {
      // Check if already following
      const { data: existingFollow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', quest.host_id)
        .maybeSingle();

      if (!existingFollow) {
        // Auto-follow the host
        const { error: followError } = await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: quest.host_id });

        if (!followError) {
          followedHost = true;
        }
      }
    }

    setLoading(false);

    // Show appropriate toast based on follow status
    if (followedHost && host?.nick) {
      toast({ 
        title: "Spot joined!", 
        description: `You joined the event and are now following ${host.nick} for updates.` 
      });
    } else {
      toast({ title: "Spot joined!", description: "You're now part of the group." });
    }
    
    setHasJoined(true);
    onJoin?.(quest.id);
    await refreshParticipants();
  };

  const handleLeaveSpot = async () => {
    if (!quest) return;
    setLoading(true);

    const { error } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', quest.id)
      .eq('user_id', currentUserId);

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to leave",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Left spot" });
    setHasJoined(false);
    setParticipants(prev => prev.filter(p => p.user_id !== currentUserId));
    onLeave?.(quest.id);
  };

  const handleDelete = async () => {
    if (!quest) return;
    setLoading(true);

    const { error } = await supabase
      .from('megaphones')
      .delete()
      .eq('id', quest.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Spot deleted" });
    onDelete();
    onOpenChange(false);
  };

  const handleSaveEdit = async () => {
    if (!quest || !editTitle.trim() || !editDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate max 24 hour duration
    if (editDuration > 24) {
      toast({
        title: "Duration too long",
        description: "Event cannot last longer than 24 hours.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const [hours, minutes] = editTime.split(':').map(Number);
    const startTime = new Date(editDate);
    startTime.setHours(hours, minutes, 0, 0);

    const { data, error } = await supabase
      .from('megaphones')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        category: editIcon || quest.category, // Use selected emoji as category
        start_time: startTime.toISOString(),
        duration_minutes: editDuration * 60,
      })
      .eq('id', quest.id)
      .select()
      .single();

    setLoading(false);

    if (error || !data) {
      toast({
        title: "Failed to update",
        description: error?.message || "Unknown error",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Spot updated!" });
    setIsEditing(false);
    onUpdate?.(data);
  };

  if (!quest) return null;

  const startTime = new Date(quest.start_time);
  const endTime = new Date(startTime.getTime() + quest.duration_minutes * 60000);
  // Total members = host (1) + filtered participants (excluding host)
  const totalMembers = filteredParticipants.length + 1;
  const durationHours = quest.duration_minutes / 60;

  const handleClose = () => {
    setIsEditing(false);
    onOpenChange(false);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" style={{ isolation: 'isolate' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-transparent"
        onClick={handleClose}
      />

      <div className="relative bg-card border-2 border-border rounded-t-2xl sm:rounded-2xl shadow-hard w-full sm:max-w-md max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300 z-10">
        {isEditing ? (
          /* Edit Mode */
          <div className="py-4 px-4 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h2 className="font-fredoka text-xl">Edit Spot</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => {
                  e.stopPropagation();
                  cancelEditing();
                }}
                className="rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Title */}
            <div className="space-y-2">
              <Label className="font-nunito text-sm font-medium text-foreground">
                Title
              </Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-muted/50 border-2 border-border rounded-xl"
                maxLength={100}
              />
            </div>

            {/* Icon Selection - Emoji Picker */}
            <div className="space-y-2">
              <Label className="font-nunito text-sm font-medium text-foreground">
                Icon
              </Label>
              <EmojiPicker 
                value={editIcon} 
                onChange={setEditIcon} 
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-nunito font-medium text-muted-foreground">
                  Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-muted/50 border-border/50",
                        !editDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDate ? format(editDate, "MMM d") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editDate}
                      onSelect={setEditDate}
                      disabled={(d) => startOfDay(d) < startOfDay(new Date())}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-nunito font-medium text-muted-foreground">
                  Time
                </Label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  min={minTime}
                  className="bg-muted/50 border-border/50"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-xs font-nunito font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Duration (hrs)
              </Label>
              <Input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={editDuration}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditDuration(Math.min(val, 24));
                }}
                className="bg-muted/50 border-border/50"
              />
              {editDuration > 24 && (
                <p className="text-[10px] text-destructive">
                  Max duration is 24 hours
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs font-nunito font-medium text-muted-foreground">
                Description
              </Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-muted/50 border-border/50 min-h-[80px] resize-none"
                maxLength={500}
              />
            </div>

            {/* Save/Cancel Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 min-h-[48px]"
                onClick={cancelEditing}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 min-h-[48px]"
                onClick={handleSaveEdit}
                disabled={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          /* Details View - Optimized Layout */
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Cover Image for Official Events */}
            {quest.is_official && quest.cover_image_url && (
              <div className="relative w-full h-40 shrink-0">
                <img 
                  src={quest.cover_image_url} 
                  alt={quest.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                <Badge 
                  variant="outline" 
                  className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-amber-400 font-bold"
                >
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Official Event
                </Badge>
              </div>
            )}
            
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  quest.is_official 
                    ? 'bg-gradient-to-br from-amber-500 to-yellow-400' 
                    : 'bg-primary/20 border border-primary/40'
                }`}>
                  {quest.is_official ? (
                    <Star className="w-5 h-5 text-black fill-current" />
                  ) : isEmoji(quest.category) ? (
                    <span className="text-lg">{quest.category}</span>
                  ) : (
                    <Users className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="font-nunito font-bold text-foreground">
                    {quest.is_official ? 'Official Event' : 'Spot'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {quest.is_official && !quest.cover_image_url && (
                      <Badge variant="outline" className="bg-gradient-to-r from-amber-500/20 to-yellow-400/20 text-amber-500 border-amber-400/40 text-[10px] px-1.5 py-0">
                        <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
                        Official
                      </Badge>
                    )}
                    {quest.is_private && (
                      <Badge variant="outline" className="bg-warning/20 text-warning border-warning/40 text-[10px] px-1.5 py-0">
                        <Lock className="w-2.5 h-2.5 mr-0.5" />
                        Private
                      </Badge>
                    )}
                    {isHost && (
                      <Badge variant="outline" className="bg-success/20 text-success border-success/40 text-[10px] px-1.5 py-0">
                        HOST
                      </Badge>
                    )}
                    {hasJoined && !isHost && (
                      <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 text-[10px] px-1.5 py-0">
                        JOINED
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Spot Name - Prominent */}
              <h2 className="font-fredoka text-2xl text-foreground leading-tight mb-4">
                {quest.title}
              </h2>

              {/* Location Details for Official Events */}
              {quest.is_official && quest.location_details && (
                <div className="flex items-start gap-2 mb-4 p-3 bg-muted/50 rounded-xl border border-border/50">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{quest.location_details}</span>
                </div>
              )}

              {/* External Link CTA for Official Events */}
              {quest.is_official && quest.external_link && (
                <a 
                  href={quest.external_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full mb-4 py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold rounded-xl hover:from-amber-600 hover:to-yellow-500 transition-all shadow-lg hover:shadow-xl"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit Website
                </a>
              )}

            {/* 2. PARTICIPANTS - Avatars (organizer first, no clipping) */}
            <div className="mt-4 px-1">
              <div className="flex items-center gap-1 overflow-visible">
                {/* Organizer - show display name for official events, avatar for regular */}
                {quest.is_official && quest.organizer_display_name ? (
                  // Official Event: Show organizer display name badge
                  <div className="flex flex-col items-center gap-1 p-1.5 flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center">
                      <Crown className="w-6 h-6 text-black" />
                    </div>
                    <span className="text-[10px] font-bold text-amber-500 truncate max-w-[64px]">
                      {quest.organizer_display_name}
                    </span>
                  </div>
                ) : (
                  // Regular Spot: Show host avatar with crown indicator
                  <button
                    onClick={() => {
                      if (host) {
                        handleViewProfileInModal(host);
                      }
                    }}
                    className="flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-primary/10 transition-colors flex-shrink-0"
                  >
                    <div className="relative">
                      <div className="w-12 h-12">
                        <AvatarDisplay 
                          config={host?.avatar_config} 
                          size={48} 
                          showGlow={false}
                        />
                      </div>
                      {/* Crown indicator for host */}
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center border-2 border-card">
                        <span className="text-[10px]">👑</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-warning truncate max-w-[52px]">
                      {host?.nick || 'Host'}
                    </span>
                  </button>
                )}

                {/* Participant avatars - filtered to exclude host */}
                {filteredParticipants.slice(0, MAX_VISIBLE_AVATARS).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (p.profile) {
                        handleViewProfileInModal(p.profile);
                      }
                    }}
                    className="flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-primary/10 transition-colors flex-shrink-0"
                  >
                    <div className="w-12 h-12">
                      <AvatarDisplay 
                        config={p.profile?.avatar_config} 
                        size={48} 
                        showGlow={false}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-foreground truncate max-w-[52px]">
                      {p.profile?.nick || '?'}
                    </span>
                  </button>
                ))}

                {/* More participants indicator - opens full list modal */}
                {filteredParticipants.length > MAX_VISIBLE_AVATARS && (
                  <button 
                    onClick={() => setShowAllParticipants(true)}
                    className="flex flex-col items-center gap-1 p-1.5 flex-shrink-0 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/40">
                      <span className="text-xs font-bold text-primary">
                        +{filteredParticipants.length - MAX_VISIBLE_AVATARS}
                      </span>
                    </div>
                    <span className="text-[10px] text-primary font-medium">See All</span>
                  </button>
                )}

                {/* Empty slot if few participants */}
                {totalMembers < 3 && (
                  <div className="flex flex-col items-center gap-1 p-1.5 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center border-2 border-dashed border-border/50">
                      <Users className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Join!</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. META-INFO - Compact grid with icons */}
            <div className="mt-4 px-1">
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
                {/* Date */}
                <div className="flex flex-col items-center text-center">
                  <CalendarIcon className="w-5 h-5 text-primary mb-1" />
                  <span className="text-xs font-semibold text-foreground">
                    {format(startTime, 'MMM d')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(startTime, 'EEE')}
                  </span>
                </div>
                
                {/* Time */}
                <div className="flex flex-col items-center text-center border-x border-border/30">
                  <Clock className="w-5 h-5 text-primary mb-1" />
                  <span className="text-xs font-semibold text-foreground">
                    {format(startTime, 'h:mm a')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Start
                  </span>
                </div>
                
                {/* Duration */}
                <div className="flex flex-col items-center text-center">
                  <Hourglass className="w-5 h-5 text-primary mb-1" />
                  <span className="text-xs font-semibold text-foreground">
                    {durationHours}h
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Duration
                  </span>
                </div>
              </div>
            </div>

            {/* 4. DESCRIPTION */}
            {quest.description && (
              <div className="mt-4">
                <p className="text-sm text-foreground/90 leading-relaxed font-nunito">
                  {quest.description}
                </p>
              </div>
            )}

            {/* Comments Section */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <EntityComments
                entityType="spot"
                entityId={quest.id}
                currentUserId={currentUserId}
                comments={comments}
                onAddComment={addComment}
                onDeleteComment={deleteComment}
                getLikes={getCommentLikes}
                toggleLike={toggleCommentLike}
                onViewUserProfile={handleViewProfileInModal}
              />
            </div>
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="p-4 border-t border-border/50 space-y-3 shrink-0">
              {isGuest ? (
                <Button 
                  className="w-full font-fredoka min-h-[52px] text-base"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/auth');
                  }}
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Login to Join
                </Button>
              ) : isHost ? (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 min-h-[48px]"
                    onClick={startEditing}
                    disabled={loading}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive"
                    className="flex-1 min-h-[48px]"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              ) : hasJoined ? (
                /* Participant actions: Leave Spot */
                <Button 
                  variant="destructive"
                  className="w-full min-h-[48px]"
                  onClick={handleLeaveSpot}
                  disabled={loading}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave Spot
                </Button>
              ) : (
                /* Not joined: Show Join Spot button */
                <Button 
                  className="w-full font-fredoka min-h-[52px] text-base"
                  onClick={handleJoin}
                  disabled={loading}
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Join Spot
                </Button>
              )}
              
              {/* Share button - always visible */}
              <Button 
                variant="outline"
                className="w-full border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground min-h-[44px]"
                onClick={async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  if (!quest) return;
                  const shareUrl = `${window.location.origin}/?c=${quest.share_code || quest.id}`;
                  
                  // Try native share first (mobile)
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: quest.title,
                        text: `Check out this spot: ${quest.title}`,
                        url: shareUrl,
                      });
                      return;
                    } catch (err) {
                      // User cancelled or share failed, fall back to clipboard
                      if ((err as Error).name === 'AbortError') return;
                    }
                  }
                  
                  // Fallback to clipboard
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast({
                      title: 'Link copied to clipboard!',
                    });
                  } catch (err) {
                    toast({
                      title: 'Failed to copy link',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {open && createPortal(modalContent, document.body)}
      
      {/* Profile Modal - renders on top when viewing a profile */}
      <ProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        user={selectedProfileForModal}
        currentUserId={currentUserId}
        isConnected={false}
        showBackButton={true}
        onBack={() => setProfileModalOpen(false)}
        onNavigate={(path) => {
          setProfileModalOpen(false);
          onOpenChange(false);
          navigate(path);
        }}
      />
      {/* See All Participants Modal */}
      <Dialog open={showAllParticipants} onOpenChange={setShowAllParticipants}>
        <DialogContent className="bg-card border-primary/30 max-w-md max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-fredoka text-xl">All Participants</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-2 p-2">
              {/* Host first */}
              {host && (
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-primary/10 transition-colors">
                  <button
                    onClick={() => {
                      setShowAllParticipants(false);
                      handleViewProfileInModal(host);
                    }}
                    className="flex items-center gap-3 flex-1"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12">
                        <AvatarDisplay 
                          config={host.avatar_config} 
                          size={48} 
                          showGlow={false}
                        />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center border-2 border-card">
                        <span className="text-[10px]">👑</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-warning truncate">
                      {host.nick || 'Host'}
                    </span>
                  </button>
                </div>
              )}
              
              {/* All filtered participants */}
              {filteredParticipants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-primary/10 transition-colors">
                  <button
                    onClick={() => {
                      if (p.profile) {
                        setShowAllParticipants(false);
                        handleViewProfileInModal(p.profile);
                      }
                    }}
                    className="flex items-center gap-3 flex-1"
                  >
                    <div className="w-12 h-12 flex-shrink-0">
                      <AvatarDisplay 
                        config={p.profile?.avatar_config} 
                        size={48} 
                        showGlow={false}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">
                      {p.profile?.nick || '?'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuestLobby;
