import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

let channelSeq = 0;

/**
 * Create a Supabase Realtime channel with a UNIQUE name per hook instance.
 *
 * IMPORTANT:
 * - Multiple parts of the UI (map + drawer + navbar) can mount realtime hooks simultaneously.
 * - If they share the same channel name, one hook's cleanup can remove the channel for others.
 * - To avoid cross-hook interference, we create a unique channel name every time.
 *
 * @param channelName - Base name of the channel (used for debugging)
 * @returns A fresh channel instance, always with shouldSubscribe: true
 */
export const getOrCreateChannel = (channelName: string): { 
  channel: RealtimeChannel; 
  isNew: boolean;
  shouldSubscribe: boolean;
} => {
  // Make name unique but stable for this specific call
  channelSeq += 1;
  const uniqueName = `${channelName}__${channelSeq}`;

  // Create a fresh channel (do NOT remove other channels with same base name)
  const newChannel = supabase.channel(uniqueName);
  return { 
    channel: newChannel, 
    isNew: true, 
    shouldSubscribe: true 
  };
};

/**
 * Safely remove a channel
 */
export const safeRemoveChannel = (channel: RealtimeChannel | null) => {
  if (!channel) return;
  
  try {
    supabase.removeChannel(channel);
  } catch (error) {
    // Ignore errors during cleanup
    console.debug('[RealtimeUtils] Channel cleanup error (safe to ignore):', error);
  }
};
