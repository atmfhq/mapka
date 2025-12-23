import { useEffect, useState, useMemo } from 'react';
import { format, startOfDay, isToday } from 'date-fns';
import { Clock, Users, Trash2, UserPlus, X, Lock, Shield, Pencil, Save, ChevronRight, CalendarIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LobbyChatMessages from './LobbyChatMessages';
import { ACTIVITIES, ACTIVITY_CATEGORIES, getCategoryForActivity, getActivityById, getActivitiesByCategory, ActivityCategory } from '@/constants/activities';

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
  profile?: Profile;
}

interface QuestLobbyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quest: Quest | null;
  currentUserId: string;
  onDelete: () => void;
  onJoin?: (questId: string) => void;
  onLeave?: (questId: string) => void;
  onUpdate?: (quest: Quest) => void;
  onViewUserProfile?: (user: Profile) => void;
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
  onViewUserProfile
}: QuestLobbyProps) => {
  const [host, setHost] = useState<Profile | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState<Date>();
  const [editTime, setEditTime] = useState('18:00');
  const [editDuration, setEditDuration] = useState(2);
  const [editCategory, setEditCategory] = useState<ActivityCategory | null>(null);
  const [editActivity, setEditActivity] = useState<string | null>(null);

  const isHost = quest?.host_id === currentUserId;
  const canAccessChat = isHost || hasJoined;

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
    
    setActiveTab('info');
    setIsEditing(false);

    const fetchData = async () => {
      // Use secure RPC function to get public profile data
      const { data: hostProfiles } = await supabase
        .rpc('get_public_profiles_by_ids', { user_ids: [quest.host_id] });
      
      const hostData = hostProfiles?.[0];
      
      if (hostData) setHost(hostData as Profile);

      const { data: participantsData } = await supabase
        .from('event_participants')
        .select('id, user_id, status')
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
        setHasJoined(participantsData.some(p => p.user_id === currentUserId));
      }
    };

    fetchData();
  }, [quest, currentUserId]);

  const refreshParticipants = async () => {
    if (!quest) return;
    
    const { data } = await supabase
      .from('event_participants')
      .select('id, user_id, status')
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
    }
  };

  const handleJoin = async () => {
    if (!quest) return;
    setLoading(true);

    const { error } = await supabase.from('event_participants').insert({
      event_id: quest.id,
      user_id: currentUserId,
      status: 'joined',
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

    toast({ title: "Quest joined!", description: "You're now part of the squad." });
    setHasJoined(true);
    onJoin?.(quest.id);
    await refreshParticipants();
    setActiveTab('comms');
  };

  const handleLeave = async () => {
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

    toast({ title: "Left quest" });
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

    toast({ title: "Quest deleted" });
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

    toast({ title: "Quest updated!" });
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
  const totalMembers = participants.length + 1;

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      if (!newOpen) setIsEditing(false);
      onOpenChange(newOpen);
    }}>
      <SheetContent 
        side="bottom" 
        className="bg-card border-t border-primary/30 rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <SheetHeader className="space-y-4 pb-4 border-b border-border/50">
          {quest.is_private && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30">
              <Shield className="w-5 h-5 text-warning" />
              <span className="font-fredoka text-sm text-warning">
                Private Quest
              </span>
              <Lock className="w-4 h-4 text-warning ml-auto" />
            </div>
          )}

          <div className="flex items-center justify-between">
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
                    'Private Quest'
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
                <Badge variant="outline" className="bg-success/20 text-success border-success/40">
                  HOST
                </Badge>
              )}
              {hasJoined && !isHost && (
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40">
                  JOINED
                </Badge>
              )}
            </div>
          </div>

          <SheetTitle className="font-fredoka text-2xl text-left">
            {quest.title}
          </SheetTitle>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              <span>{format(startTime, 'MMM d, h:mm a')}</span>
              <span className="text-muted-foreground/50">→</span>
              <span>{format(endTime, 'h:mm a')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              <span>{totalMembers} joined</span>
            </div>
          </div>

          {quest.description && !isEditing && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {quest.description}
            </p>
          )}
        </SheetHeader>

        {/* Edit Mode */}
        {isEditing ? (
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
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
                        <span className="font-rajdhani text-sm truncate">{activity.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
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
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
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
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
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
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
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
          /* Normal View Mode */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 bg-muted/30 flex-shrink-0">
              <TabsTrigger value="info" className="font-mono text-xs min-h-[44px]">
                INTEL
              </TabsTrigger>
              <TabsTrigger 
                value="comms" 
                disabled={!canAccessChat}
                className="font-mono text-xs min-h-[44px]"
              >
                COMMS {!canAccessChat && '🔒'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="py-4 space-y-6 overflow-y-auto flex-1">
              {/* Host */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Mission Commander
                </h4>
                <button
                  onClick={() => {
                    if (host) {
                      onOpenChange(false);
                      onViewUserProfile?.(host);
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors w-full text-left"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden">
                    <AvatarDisplay 
                      config={host?.avatar_config} 
                      size={48} 
                      showGlow={false}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-warning">{host?.nick || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">Host</p>
                  </div>
                </button>
              </div>

              {/* Participants */}
              {participants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Squad Members ({participants.length})
                  </h4>
                  <ScrollArea className="w-full">
                    <div className="flex gap-3 pb-2">
                      {participants.slice(0, 10).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (p.profile) {
                              onOpenChange(false);
                              onViewUserProfile?.(p.profile);
                            }
                          }}
                          className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-primary/10 transition-colors min-w-[72px]"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden">
                            <AvatarDisplay 
                              config={p.profile?.avatar_config} 
                              size={48} 
                              showGlow={false}
                            />
                          </div>
                          <span className="text-xs font-medium text-foreground truncate max-w-[64px]">
                            {p.profile?.nick || 'Anonymous'}
                          </span>
                        </button>
                      ))}
                      {participants.length > 10 && (
                        <div className="flex items-center justify-center min-w-[72px] p-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            +{participants.length - 10} more
                          </span>
                        </div>
                      )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t border-border/50">
                {isHost ? (
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
                ) : hasJoined ? (
                  <Button 
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 min-h-[48px]"
                    onClick={handleLeave}
                    disabled={loading}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Leave Mission
                  </Button>
                ) : (
                  <Button 
                    className="w-full bg-success hover:bg-success/90 text-success-foreground font-orbitron min-h-[52px] text-base"
                    onClick={handleJoin}
                    disabled={loading}
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    JOIN MISSION
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comms" className="py-4 flex-1 flex flex-col min-h-0">
              {canAccessChat && quest && (
                <LobbyChatMessages 
                  eventId={quest.id} 
                  currentUserId={currentUserId} 
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default QuestLobby;