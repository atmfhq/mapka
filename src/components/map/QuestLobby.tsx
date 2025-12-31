import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, isToday } from 'date-fns';
import { Clock, Users, Trash2, UserPlus, X, Lock, Shield, Pencil, Save, ChevronRight, CalendarIcon, LogIn, Hourglass, User, MessageCircle, LogOut, MessageCircleOff, UserX, Ban, Unlock, Share2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ACTIVITIES, ACTIVITY_CATEGORIES, getActivityById, getActivitiesByCategory, ActivityCategory } from '@/constants/activities';
import { useSpotBans } from '@/hooks/useSpotBans';

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
  location_lat: number;
  location_lng: number;
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
  onOpenSpotChat?: (eventId: string) => void;
  onLeaveChatSuccess?: (eventId: string) => void;
  onJoinChatSuccess?: (eventId: string) => void;
  isUserInViewport?: (lat: number, lng: number) => boolean;
}

const getActivityByLabel = (label: string) => {
  return ACTIVITIES.find(a => a.label.toLowerCase() === label.toLowerCase());
};

const getCategoryColorClasses = (category: string): string => {
  const activityData = getActivityByLabel(category);
  if (activityData) {
    switch (activityData.category) {
      case 'sport': return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'tabletop': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'social': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'outdoor': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  }
  const LEGACY_COLORS: Record<string, string> = {
    Sport: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    Gaming: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    Food: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    Party: 'bg-pink-500/20 text-pink-400 border-pink-500/40',
    Other: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
  };
  return LEGACY_COLORS[category] || LEGACY_COLORS.Other;
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
  onOpenSpotChat,
  onLeaveChatSuccess,
  onJoinChatSuccess,
  isUserInViewport
}: QuestLobbyProps) => {
  const navigate = useNavigate();
  const [host, setHost] = useState<Profile | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isChatActive, setIsChatActive] = useState(true);
  const [isChatBlocked, setIsChatBlocked] = useState(false);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [showBannedUsers, setShowBannedUsers] = useState(false);
  
  // Spot bans hook
  const { bannedUsers, banUser, unbanUser, checkIfBanned, loading: banLoading } = useSpotBans(
    quest?.id || null,
    quest?.host_id === currentUserId
  );
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState<Date>();
  const [editTime, setEditTime] = useState('18:00');
  const [editDuration, setEditDuration] = useState(2);
  const [editCategory, setEditCategory] = useState<ActivityCategory | null>(null);
  const [editActivity, setEditActivity] = useState<string | null>(null);

  const MAX_VISIBLE_AVATARS = 5;
  const isGuest = !currentUserId;
  const isHost = quest?.host_id === currentUserId;

  // Filter out host from participants to avoid duplication
  const filteredParticipants = useMemo(() => {
    if (!quest) return [];
    return participants.filter(p => p.user_id !== quest.host_id);
  }, [participants, quest]);

  // Get activities for selected category
  const categoryActivities = useMemo(() => {
    if (!editCategory) return [];
    return getActivitiesByCategory(editCategory);
  }, [editCategory]);

  // Calculate min time based on selected date
  const minTime = useMemo(() => {
    if (!editDate) return undefined;
    if (isToday(editDate)) {
      return getMinTimeForToday();
    }
    return undefined;
  }, [editDate]);

  const selectedActivityData = editActivity ? getActivityById(editActivity) : null;
  const selectedCategoryData = editCategory ? ACTIVITY_CATEGORIES.find(c => c.id === editCategory) : null;

  // Initialize edit form when entering edit mode
  const startEditing = () => {
    if (!quest) return;
    
    const startTime = new Date(quest.start_time);
    const activityData = getActivityByLabel(quest.category);
    
    setEditTitle(quest.title);
    setEditDescription(quest.description || '');
    setEditDate(startTime);
    setEditTime(format(startTime, 'HH:mm'));
    setEditDuration(quest.duration_minutes / 60);
    
    if (activityData) {
      setEditCategory(activityData.category as ActivityCategory);
      setEditActivity(activityData.id);
    } else {
      setEditCategory(null);
      setEditActivity(null);
    }
    
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditCategory(null);
    setEditActivity(null);
  };

  // Fetch host profile and participants
  useEffect(() => {
    if (!quest) return;
    
    setIsEditing(false);

    const fetchData = async () => {
      const { data: hostProfiles } = await supabase
        .rpc('get_public_profiles_by_ids', { user_ids: [quest.host_id] });
      
      const hostData = hostProfiles?.[0];
      
      if (hostData) setHost(hostData as Profile);

      const { data: participantsData } = await supabase
        .from('event_participants')
        .select('id, user_id, status, chat_active, is_chat_banned')
        .eq('event_id', quest.id);

      if (participantsData) {
        const userIds = participantsData.map(p => p.user_id);
        const { data: profiles } = await supabase
          .rpc('get_public_profiles_by_ids', { user_ids: userIds });

        const participantsWithProfiles = participantsData.map(p => ({
          ...p,
          profile: profiles?.find(pr => pr.id === p.user_id) as Profile | undefined,
        }));

        setParticipants(participantsWithProfiles);
        const currentParticipant = participantsData.find(p => p.user_id === currentUserId);
        setHasJoined(!!currentParticipant);
        setIsChatActive(currentParticipant?.chat_active ?? true);
        setIsChatBlocked(currentParticipant?.is_chat_banned ?? false);
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
        .rpc('get_public_profiles_by_ids', { user_ids: userIds });

      const participantsWithProfiles = data.map(p => ({
        ...p,
        profile: profiles?.find(pr => pr.id === p.user_id) as Profile | undefined,
      }));

      setParticipants(participantsWithProfiles);
      const currentParticipant = data.find(p => p.user_id === currentUserId);
      setIsChatActive(currentParticipant?.chat_active ?? true);
      setIsChatBlocked(currentParticipant?.is_chat_banned ?? false);
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

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to join",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Spot joined!", description: "You're now part of the group." });
    setHasJoined(true);
    setIsChatActive(true);
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
    setIsChatActive(true);
    setParticipants(prev => prev.filter(p => p.user_id !== currentUserId));
    onLeave?.(quest.id);
  };

  const handleJoinChat = async () => {
    if (!quest) return;
    setLoading(true);

    // Update joined_at when rejoining chat so they get fresh history
    const { error } = await supabase
      .from('event_participants')
      .update({ chat_active: true, joined_at: new Date().toISOString() })
      .eq('event_id', quest.id)
      .eq('user_id', currentUserId);

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to join chat",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Joined chat" });
    setIsChatActive(true);
    await refreshParticipants();
    onJoinChatSuccess?.(quest.id);
  };

  const handleLeaveChat = async () => {
    if (!quest) return;
    setLoading(true);

    const { error } = await supabase
      .from('event_participants')
      .update({ chat_active: false })
      .eq('event_id', quest.id)
      .eq('user_id', currentUserId);

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to leave chat",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Left chat", description: "You're still attending the spot." });
    setIsChatActive(false);
    await refreshParticipants();
    onLeaveChatSuccess?.(quest.id);
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

    setLoading(true);

    const [hours, minutes] = editTime.split(':').map(Number);
    const startTime = new Date(editDate);
    startTime.setHours(hours, minutes, 0, 0);

    const activityData = editActivity ? getActivityById(editActivity) : null;
    const categoryLabel = activityData?.label || quest.category;

    const { data, error } = await supabase
      .from('megaphones')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        category: categoryLabel,
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

  const handleCategorySelect = (categoryId: ActivityCategory) => {
    setEditCategory(categoryId);
    setEditActivity(null);
  };

  const handleActivitySelect = (activityId: string) => {
    setEditActivity(activityId);
  };

  const handleBanUser = async (userId: string) => {
    if (!currentUserId) return;
    const success = await banUser(userId, currentUserId);
    if (success) {
      // Refresh participants list after ban
      await refreshParticipants();
    }
  };

  const handleUnbanUser = async (banId: string) => {
    await unbanUser(banId);
  };

  const handleEditBack = () => {
    if (editActivity) {
      setEditActivity(null);
    } else if (editCategory) {
      setEditCategory(null);
    }
  };

  if (!quest) return null;

  const startTime = new Date(quest.start_time);
  const endTime = new Date(startTime.getTime() + quest.duration_minutes * 60000);
  // Total members = host (1) + filtered participants (excluding host)
  const totalMembers = filteredParticipants.length + 1;
  const durationHours = quest.duration_minutes / 60;

  return (
    <>
    <Sheet open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        setIsEditing(false);
      }
      onOpenChange(newOpen);
    }}>
      <SheetContent 
        side="bottom" 
        className="bg-card border-t border-primary/30 rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        {isEditing ? (
          /* Edit Mode */
          <div className="py-4 px-4 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h2 className="font-fredoka text-xl">Edit Spot</h2>
              <Button variant="ghost" size="icon" onClick={cancelEditing}>
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

            {/* Activity Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-nunito text-sm font-medium text-foreground">
                  Activity
                </Label>
                {(editCategory || editActivity) && (
                  <button
                    onClick={handleEditBack}
                    className="text-xs text-primary hover:underline font-nunito font-medium"
                  >
                    ← Back
                  </button>
                )}
              </div>

              {selectedActivityData && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/40">
                  <span className="text-2xl">{selectedActivityData.icon}</span>
                  <div>
                    <p className="font-semibold text-primary">{selectedActivityData.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{selectedActivityData.category}</p>
                  </div>
                  <button
                    onClick={() => setEditActivity(null)}
                    className="ml-auto text-muted-foreground hover:text-foreground text-sm"
                  >
                    Change
                  </button>
                </div>
              )}

              {!editCategory && !selectedActivityData && (
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITY_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <span className="text-2xl">{category.icon}</span>
                      <span className="font-nunito font-medium">{category.label}</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {editCategory && !selectedActivityData && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                    <span>{selectedCategoryData?.icon}</span>
                    <span className="font-nunito">{selectedCategoryData?.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto">
                    {categoryActivities.map((activity) => (
                      <button
                        key={activity.id}
                        onClick={() => handleActivitySelect(activity.id)}
                        className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                      >
                        <span className="text-lg">{activity.icon}</span>
                        <span className="font-nunito text-sm truncate">{activity.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                onChange={(e) => setEditDuration(Number(e.target.value))}
                className="bg-muted/50 border-border/50"
              />
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
                className="flex-1 bg-primary hover:bg-primary/90 min-h-[48px]"
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
          <div className="flex flex-col flex-1 overflow-y-auto py-3">
            {/* 1. HEADER - Title at top */}
            <div className="px-1">
              {/* Status badges row */}
              <div className="flex items-center justify-between mb-2">
                {(() => {
                  const activityData = getActivityByLabel(quest.category);
                  return (
                    <Badge 
                      variant="outline" 
                      className={quest.is_private 
                        ? 'bg-warning/20 text-warning border-warning/40' 
                        : getCategoryColorClasses(quest.category)
                      }
                    >
                      {quest.is_private ? (
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Private
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {activityData && <span>{activityData.icon}</span>}
                          {quest.category}
                        </span>
                      )}
                    </Badge>
                  );
                })()}
                <div className="flex items-center gap-2">
                  {isHost && (
                    <Badge variant="outline" className="bg-success/20 text-success border-success/40 text-xs">
                      HOST
                    </Badge>
                  )}
                  {hasJoined && !isHost && (
                    <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 text-xs">
                      JOINED
                    </Badge>
                  )}
                </div>
              </div>

              {/* Spot Name - Prominent */}
              <h2 className="font-fredoka text-2xl text-foreground leading-tight">
                {quest.title}
              </h2>
            </div>

            {/* 2. PARTICIPANTS - Avatars (organizer first, no clipping) */}
            <div className="mt-4 px-1">
              <div className="flex items-center gap-1 overflow-visible">
                {/* Organizer avatar - always first with crown indicator */}
                <button
                  onClick={() => {
                    if (host) {
                      // Check if host is in viewport
                      if (isUserInViewport && host.location_lat && host.location_lng) {
                        if (!isUserInViewport(host.location_lat, host.location_lng)) {
                          toast({
                            title: "User not visible",
                            description: "User is currently not visible in this area.",
                          });
                          return;
                        }
                      }
                      onOpenChange(false);
                      onViewUserProfile?.(host);
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

                {/* Participant avatars - filtered to exclude host */}
                {filteredParticipants.slice(0, MAX_VISIBLE_AVATARS).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (p.profile) {
                        // Check if participant is in viewport
                        if (isUserInViewport && p.profile.location_lat && p.profile.location_lng) {
                          if (!isUserInViewport(p.profile.location_lat, p.profile.location_lng)) {
                            toast({
                              title: "User not visible",
                              description: "User is currently not visible in this area.",
                            });
                            return;
                          }
                        }
                        onOpenChange(false);
                        onViewUserProfile?.(p.profile);
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
              <div className="mt-4 px-1">
                <p className="text-sm text-foreground/90 leading-relaxed font-nunito">
                  {quest.description}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-auto pt-4 border-t border-border/50 space-y-3">
              {isGuest ? (
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-fredoka min-h-[52px] text-base"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/auth');
                  }}
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Login to Join
                </Button>
              ) : isHost ? (
                /* Host actions: Open Chat, Edit, Delete */
                <>
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-fredoka min-h-[52px] text-base"
                    onClick={() => {
                      if (quest) {
                        onOpenChange(false);
                        onOpenSpotChat?.(quest.id);
                      }
                    }}
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Open Chat
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-primary/50 text-primary hover:bg-primary/10 min-h-[48px]"
                      onClick={startEditing}
                      disabled={loading}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 min-h-[48px]"
                      onClick={handleDelete}
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                  {/* Manage Banned Users button */}
                  <Button 
                    variant="outline"
                    className="w-full border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 min-h-[44px]"
                    onClick={() => setShowBannedUsers(true)}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Manage Banned ({bannedUsers.length})
                  </Button>
                </>
              ) : hasJoined ? (
                /* Participant actions: Chat (Join/Open/Leave), Leave Spot */
                <>
                  {isChatBlocked ? (
                    /* Blocked from chat: Show blocked state */
                    <div className="w-full p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center">
                      <Ban className="w-6 h-6 text-destructive mx-auto mb-2" />
                      <p className="text-sm font-medium text-destructive">You are blocked from this chat</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Contact the organizer to be unblocked
                      </p>
                    </div>
                  ) : isChatActive ? (
                    /* In chat: Show Open Chat + Leave Chat */
                    <>
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-fredoka min-h-[52px] text-base"
                        onClick={() => {
                          if (quest) {
                            onOpenChange(false);
                            onOpenSpotChat?.(quest.id);
                          }
                        }}
                      >
                        <MessageCircle className="w-5 h-5 mr-2" />
                        Open Chat
                      </Button>
                      <Button 
                        variant="outline"
                        className="w-full border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 min-h-[44px]"
                        onClick={handleLeaveChat}
                        disabled={loading}
                      >
                        <MessageCircleOff className="w-4 h-4 mr-2" />
                        Leave Chat
                      </Button>
                    </>
                  ) : (
                    /* Not in chat: Show Join Chat button */
                    <Button 
                      className="w-full bg-success hover:bg-success/90 text-success-foreground font-fredoka min-h-[52px] text-base"
                      onClick={handleJoinChat}
                      disabled={loading}
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Join Chat
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 min-h-[48px]"
                    onClick={handleLeaveSpot}
                    disabled={loading}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Leave Spot
                  </Button>
                </>
              ) : (
                /* Not joined: Show Join Spot button */
                <Button 
                  className="w-full bg-success hover:bg-success/90 text-success-foreground font-fredoka min-h-[52px] text-base"
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
                onClick={async () => {
                  if (!quest) return;
                  const shareUrl = `${window.location.origin}/?eventId=${quest.id}`;
                  
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
      </SheetContent>
    </Sheet>

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
                      if (isUserInViewport && host.location_lat && host.location_lng) {
                        if (!isUserInViewport(host.location_lat, host.location_lng)) {
                          toast({
                            title: "User not visible",
                            description: "User is currently not visible in this area.",
                          });
                          return;
                        }
                      }
                      setShowAllParticipants(false);
                      onOpenChange(false);
                      onViewUserProfile?.(host);
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
              
              {/* All filtered participants with ban button for host */}
              {filteredParticipants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-primary/10 transition-colors">
                  <button
                    onClick={() => {
                      if (p.profile) {
                        if (isUserInViewport && p.profile.location_lat && p.profile.location_lng) {
                          if (!isUserInViewport(p.profile.location_lat, p.profile.location_lng)) {
                            toast({
                              title: "User not visible",
                              description: "User is currently not visible in this area.",
                            });
                            return;
                          }
                        }
                        setShowAllParticipants(false);
                        onOpenChange(false);
                        onViewUserProfile?.(p.profile);
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
                  {isHost && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleBanUser(p.user_id)}
                      disabled={banLoading}
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Manage Banned Users Modal */}
      <Dialog open={showBannedUsers} onOpenChange={setShowBannedUsers}>
        <DialogContent className="bg-card border-primary/30 max-w-md max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-fredoka text-xl flex items-center gap-2">
              <Ban className="w-5 h-5 text-destructive" />
              Banned Users
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            {bannedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No banned users</p>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {bannedUsers.map((ban) => (
                  <div key={ban.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
                    <div className="w-10 h-10 flex-shrink-0">
                      <AvatarDisplay 
                        config={ban.profile?.avatar_config} 
                        size={40} 
                        showGlow={false}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">
                        {ban.profile?.nick || 'Unknown user'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Banned {format(new Date(ban.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 border-success/50 text-success hover:bg-success/10"
                      onClick={() => handleUnbanUser(ban.id)}
                      disabled={banLoading}
                    >
                      <Unlock className="w-4 h-4 mr-1" />
                      Unban
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuestLobby;
