/**
 * Avatar Parts Configuration
 * SVG paths and options for the modular avatar system
 */

export interface AvatarPartOption {
  id: string;
  label: string;
}

// ============================================
// SKIN COLORS - Now supports any hex color
// ============================================
// Preset colors for quick selection
export const PRESET_COLORS: { hex: string; label: string }[] = [
  { hex: "#00FFFF", label: "Cyan" },
  { hex: "#FF00FF", label: "Magenta" },
  { hex: "#00FF00", label: "Lime" },
  { hex: "#FF8C00", label: "Orange" },
  { hex: "#9B30FF", label: "Purple" },
  { hex: "#FFD700", label: "Yellow" },
  { hex: "#20B2AA", label: "Teal" },
  { hex: "#FF69B4", label: "Pink" },
];

// Default color (cyan)
export const DEFAULT_SKIN_COLOR = "#00FFFF";

// Legacy color mapping for backwards compatibility
export const LEGACY_COLOR_MAP: Record<string, string> = {
  cyan: "#00FFFF",
  magenta: "#FF00FF",
  lime: "#00FF00",
  orange: "#FF8C00",
  purple: "#9B30FF",
  yellow: "#FFD700",
  teal: "#20B2AA",
  pink: "#FF69B4",
};

// Helper to resolve any color value (legacy ID or hex) to hex
export const resolveColor = (colorValue: string | undefined): string => {
  if (!colorValue) return DEFAULT_SKIN_COLOR;
  // If it's a legacy color ID, convert to hex
  if (LEGACY_COLOR_MAP[colorValue]) {
    return LEGACY_COLOR_MAP[colorValue];
  }
  // If it starts with #, assume it's already hex
  if (colorValue.startsWith("#")) {
    return colorValue;
  }
  // Fallback to default
  return DEFAULT_SKIN_COLOR;
};

// Helper to darken a hex color
export const darkenHexColor = (hex: string, percent: number = 20): string => {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * (percent / 100)));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * (percent / 100)));
  const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * (percent / 100)));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase()}`;
};

// DEPRECATED: Keep for backwards compatibility but don't use in new code
export const SKIN_COLORS: AvatarPartOption[] = PRESET_COLORS.map(c => ({ id: c.hex, label: c.label }));
export const SKIN_COLOR_VALUES: Record<string, string> = Object.fromEntries(
  PRESET_COLORS.map(c => [c.hex, c.hex])
);

// ============================================
// BASE SHAPES
// ============================================
export const SHAPES: AvatarPartOption[] = [
  { id: "circle", label: "Circle" },
  { id: "squircle", label: "Squircle" },
  { id: "square", label: "Square" },
  { id: "hexagon", label: "Hexagon" },
];

// ============================================
// EYES VARIANTS
// ============================================
export const EYES: AvatarPartOption[] = [
  { id: "normal", label: "Normal" },
  { id: "happy", label: "Happy" },
  { id: "angry", label: "Angry" },
  { id: "glasses", label: "Glasses" },
  { id: "sunglasses", label: "Sunglasses" },
  { id: "wink", label: "Wink" },
];

// ============================================
// MOUTH VARIANTS
// ============================================
export const MOUTHS: AvatarPartOption[] = [
  { id: "smile", label: "Smile" },
  { id: "neutral", label: "Neutral" },
  { id: "frown", label: "Frown" },
  { id: "open", label: "Surprised" },
  { id: "smirk", label: "Smirk" },
  { id: "teeth", label: "Grin" },
];

// Default avatar configuration
export const DEFAULT_AVATAR_CONFIG = {
  skinColor: "#00FFFF", // Cyan hex
  shape: "circle",
  eyes: "normal",
  mouth: "smile",
};
