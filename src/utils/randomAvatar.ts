/**
 * Random Avatar Generator
 * Generates a unique, randomized avatar configuration
 */

import { SHAPES } from "@/components/avatar/avatarParts";
import { AVAILABLE_EYES, AVAILABLE_MOUTHS } from "@/config/avatarAssets";

export interface AvatarConfig {
  skinColor: string;
  shape: string;
  eyes: string;
  mouth: string;
}

/**
 * Returns a random element from an array
 */
const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Returns a random hex color in #RRGGBB format (uppercase).
 */
export const randomHexColor = (): string => {
  const n = Math.floor(Math.random() * 0xffffff);
  return `#${n.toString(16).padStart(6, "0").toUpperCase()}`;
};

/**
 * Generates a completely random avatar configuration
 */
export const generateRandomAvatar = (): AvatarConfig => {
  return {
    skinColor: randomHexColor(),
    shape: randomFrom(SHAPES).id,
    eyes: randomFrom(AVAILABLE_EYES),
    mouth: randomFrom(AVAILABLE_MOUTHS),
  };
};
