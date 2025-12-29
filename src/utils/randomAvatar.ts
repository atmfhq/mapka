/**
 * Random Avatar Generator
 * Generates a unique, randomized avatar configuration
 */

import { PRESET_COLORS, SHAPES } from "@/components/avatar/avatarParts";
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
 * Generates a completely random avatar configuration
 */
export const generateRandomAvatar = (): AvatarConfig => {
  return {
    skinColor: randomFrom(PRESET_COLORS).hex,
    shape: randomFrom(SHAPES).id,
    eyes: randomFrom(AVAILABLE_EYES),
    mouth: randomFrom(AVAILABLE_MOUTHS),
  };
};
