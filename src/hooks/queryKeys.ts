/**
 * Centralized query keys for React Query
 * Used for cache invalidation when engagement data changes
 */
export const queryKeys = {
  // Map data queries
  shouts: (lat: number, lng: number) => ['shouts', lat, lng] as const,
  events: (lat: number, lng: number) => ['events', lat, lng] as const,
  shoutCounts: (shoutIds: string[]) => ['shoutCounts', ...shoutIds.sort()] as const,
  
  // Engagement data (for modals/details)
  shoutComments: (shoutId: string) => ['shoutComments', shoutId] as const,
  spotComments: (spotId: string) => ['spotComments', spotId] as const,
  
  // Partial keys for bulk invalidation
  allShouts: () => ['shouts'] as const,
  allEvents: () => ['events'] as const,
  allShoutCounts: () => ['shoutCounts'] as const,
  allShoutComments: () => ['shoutComments'] as const,
  allSpotComments: () => ['spotComments'] as const,
} as const;

