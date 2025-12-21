/**
 * Avatar Parts Configuration
 * SVG paths and options for the modular avatar system
 */

export interface AvatarPartOption {
  id: string;
  label: string;
}

// ============================================
// SKIN COLORS
// ============================================
export const SKIN_COLORS: AvatarPartOption[] = [
  { id: "cyan", label: "Cyan" },
  { id: "magenta", label: "Magenta" },
  { id: "lime", label: "Lime" },
  { id: "orange", label: "Orange" },
  { id: "purple", label: "Purple" },
  { id: "yellow", label: "Yellow" },
  { id: "teal", label: "Teal" },
  { id: "pink", label: "Pink" },
];

export const SKIN_COLOR_VALUES: Record<string, string> = {
  cyan: "hsl(180, 100%, 50%)",
  magenta: "hsl(300, 100%, 60%)",
  lime: "hsl(120, 100%, 50%)",
  orange: "hsl(30, 100%, 55%)",
  purple: "hsl(270, 100%, 60%)",
  yellow: "hsl(50, 100%, 55%)",
  teal: "hsl(170, 80%, 45%)",
  pink: "hsl(330, 100%, 65%)",
};

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
  skinColor: "cyan",
  shape: "circle",
  eyes: "normal",
  mouth: "smile",
};
