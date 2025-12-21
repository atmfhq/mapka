/**
 * Offline Activities for SquadMap
 * Categorized list of strictly offline activities for user interests
 */

export interface Activity {
  id: string;
  label: string;
  icon: string;
  category: ActivityCategory;
}

export type ActivityCategory = "sport" | "tabletop" | "social" | "outdoor";

export interface CategoryInfo {
  id: ActivityCategory;
  label: string;
  icon: string;
  color: string; // Tailwind color class
}

export const ACTIVITY_CATEGORIES: CategoryInfo[] = [
  { id: "sport", label: "Sport", icon: "⚽", color: "text-success" },
  { id: "tabletop", label: "Tabletop", icon: "🎲", color: "text-accent" },
  { id: "social", label: "Social", icon: "☕", color: "text-warning" },
  { id: "outdoor", label: "Outdoor", icon: "🏕️", color: "text-primary" },
];

export const ACTIVITIES: Activity[] = [
  // ============================================
  // SPORT (12 activities)
  // ============================================
  { id: "football", label: "Football", icon: "⚽", category: "sport" },
  { id: "basketball", label: "Basketball", icon: "🏀", category: "sport" },
  { id: "volleyball", label: "Volleyball", icon: "🏐", category: "sport" },
  { id: "tennis", label: "Tennis", icon: "🎾", category: "sport" },
  { id: "badminton", label: "Badminton", icon: "🏸", category: "sport" },
  { id: "table-tennis", label: "Table Tennis", icon: "🏓", category: "sport" },
  { id: "running", label: "Running", icon: "🏃", category: "sport" },
  { id: "cycling", label: "Cycling", icon: "🚴", category: "sport" },
  { id: "gym", label: "Gym", icon: "💪", category: "sport" },
  { id: "swimming", label: "Swimming", icon: "🏊", category: "sport" },
  { id: "martial-arts", label: "Martial Arts", icon: "🥋", category: "sport" },
  { id: "skating", label: "Skating", icon: "⛸️", category: "sport" },

  // ============================================
  // TABLETOP (10 activities)
  // ============================================
  { id: "chess", label: "Chess", icon: "♟️", category: "tabletop" },
  { id: "board-games", label: "Board Games", icon: "🎲", category: "tabletop" },
  { id: "rpg-dnd", label: "RPG / D&D", icon: "🐉", category: "tabletop" },
  { id: "wargaming", label: "Wargaming", icon: "⚔️", category: "tabletop" },
  { id: "card-games", label: "Card Games", icon: "🃏", category: "tabletop" },
  { id: "poker", label: "Poker", icon: "♠️", category: "tabletop" },
  { id: "tcg", label: "TCG (MTG/Pokemon)", icon: "🎴", category: "tabletop" },
  { id: "puzzles", label: "Puzzles", icon: "🧩", category: "tabletop" },
  { id: "mahjong", label: "Mahjong", icon: "🀄", category: "tabletop" },
  { id: "billiards", label: "Billiards", icon: "🎱", category: "tabletop" },

  // ============================================
  // SOCIAL (10 activities)
  // ============================================
  { id: "coffee", label: "Coffee", icon: "☕", category: "social" },
  { id: "pub-beer", label: "Pub / Beer", icon: "🍺", category: "social" },
  { id: "dining", label: "Dining Out", icon: "🍽️", category: "social" },
  { id: "walk", label: "Walk & Talk", icon: "🚶", category: "social" },
  { id: "language-exchange", label: "Language Exchange", icon: "🗣️", category: "social" },
  { id: "music-jam", label: "Music Jam", icon: "🎸", category: "social" },
  { id: "karaoke", label: "Karaoke", icon: "🎤", category: "social" },
  { id: "dancing", label: "Dancing", icon: "💃", category: "social" },
  { id: "cooking", label: "Cooking Together", icon: "👨‍🍳", category: "social" },
  { id: "book-club", label: "Book Club", icon: "📚", category: "social" },

  // ============================================
  // OUTDOOR (10 activities)
  // ============================================
  { id: "hiking", label: "Hiking", icon: "🥾", category: "outdoor" },
  { id: "camping", label: "Camping", icon: "🏕️", category: "outdoor" },
  { id: "fishing", label: "Fishing", icon: "🎣", category: "outdoor" },
  { id: "urbex", label: "Urbex", icon: "🏚️", category: "outdoor" },
  { id: "photography", label: "Photography", icon: "📸", category: "outdoor" },
  { id: "birdwatching", label: "Birdwatching", icon: "🦅", category: "outdoor" },
  { id: "climbing", label: "Climbing", icon: "🧗", category: "outdoor" },
  { id: "kayaking", label: "Kayaking", icon: "🛶", category: "outdoor" },
  { id: "stargazing", label: "Stargazing", icon: "🌌", category: "outdoor" },
  { id: "geocaching", label: "Geocaching", icon: "📍", category: "outdoor" },
];

// Helper function to get activities by category
export const getActivitiesByCategory = (category: ActivityCategory): Activity[] => {
  return ACTIVITIES.filter((activity) => activity.category === category);
};

// Helper function to get activity by ID
export const getActivityById = (id: string): Activity | undefined => {
  return ACTIVITIES.find((activity) => activity.id === id);
};

// Helper function to get category info
export const getCategoryInfo = (categoryId: ActivityCategory): CategoryInfo | undefined => {
  return ACTIVITY_CATEGORIES.find((cat) => cat.id === categoryId);
};

// Helper function to check if any user tags belong to a specific category
export const userTagsMatchCategory = (userTags: string[] | null, category: ActivityCategory): boolean => {
  if (!userTags || userTags.length === 0) return false;
  
  const categoryActivities = getActivitiesByCategory(category);
  const categoryActivityLabels = categoryActivities.map(a => a.label.toLowerCase());
  const categoryActivityIds = categoryActivities.map(a => a.id.toLowerCase());
  
  return userTags.some(tag => {
    const lowerTag = tag.toLowerCase();
    return categoryActivityLabels.includes(lowerTag) || categoryActivityIds.includes(lowerTag);
  });
};

// Helper function to get category from activity label or id
export const getCategoryForActivity = (activityLabelOrId: string): ActivityCategory | null => {
  const lowerInput = activityLabelOrId.toLowerCase();
  const activity = ACTIVITIES.find(
    a => a.label.toLowerCase() === lowerInput || a.id.toLowerCase() === lowerInput
  );
  return activity?.category || null;
};

// Total count for reference
export const TOTAL_ACTIVITIES = ACTIVITIES.length; // 42 activities
