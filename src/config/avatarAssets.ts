/**
 * Avatar Assets Configuration
 * 
 * This file contains the master list of all available avatar assets.
 * Add new asset filenames to these arrays to make them available in the Avatar Creator.
 * 
 * USAGE:
 * - Add filenames (e.g., 'eye_1.png', 'eye_2.png') to the respective arrays
 * - Assets should be placed in the corresponding folders in public/assets/avatar/
 * - The system will automatically generate grid items for all listed assets
 */

/**
 * Available eye assets
 * Path: public/assets/avatar/eyes/{filename}
 */
export const AVAILABLE_EYES: string[] = [
  // Placeholder entries - replace with actual asset filenames
  'eye_normal.png',
  'eye_happy.png',
  'eye_angry.png',
  'eye_glasses.png',
  'eye_sunglasses.png',
  'eye_wink.png',
  // Add more eye assets here...
  // 'eye_7.png',
  // 'eye_8.png',
  // ...
];

/**
 * Available mouth assets
 * Path: public/assets/avatar/mouths/{filename}
 */
export const AVAILABLE_MOUTHS: string[] = [
  // Placeholder entries - replace with actual asset filenames
  'mouth_smile.png',
  'mouth_neutral.png',
  'mouth_frown.png',
  'mouth_open.png',
  'mouth_smirk.png',
  'mouth_teeth.png',
  // Add more mouth assets here...
  // 'mouth_7.png',
  // 'mouth_8.png',
  // ...
];

/**
 * Helper to get full asset path
 */
export const getEyeAssetPath = (filename: string): string => {
  return `/assets/avatar/eyes/${filename}`;
};

export const getMouthAssetPath = (filename: string): string => {
  return `/assets/avatar/mouths/${filename}`;
};

/**
 * Extract display name from filename
 * e.g., 'eye_happy_2.png' -> 'Happy 2'
 */
export const getAssetDisplayName = (filename: string): string => {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  // Remove prefix (eye_, mouth_)
  const nameWithoutPrefix = nameWithoutExt.replace(/^(eye_|mouth_)/, '');
  // Convert underscores to spaces and capitalize
  return nameWithoutPrefix
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
