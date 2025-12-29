/**
 * Generates a short, readable user ID from a UUID
 * Format: #XXXXXX (6 characters from the UUID)
 */
export const getShortUserId = (uuid: string): string => {
  if (!uuid) return '#000000';
  // Take first 6 characters of the UUID (after removing dashes)
  const cleanUuid = uuid.replace(/-/g, '').toUpperCase();
  return `#${cleanUuid.slice(0, 6)}`;
};
