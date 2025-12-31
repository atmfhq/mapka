// This component is used for reference - actual markers are created via DOM in TacticalMap
// Keeping for potential future React-based marker implementation

import { AvatarWithFallback } from '@/components/ui/AvatarWithFallback';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface UserMarkerProps {
  avatarUrl: string | null;
  avatarConfig?: AvatarConfig | null;
  nick: string | null;
}

const UserMarker = ({ avatarUrl, avatarConfig, nick }: UserMarkerProps) => {
  return (
    <div className="relative w-12 h-12 cursor-pointer group">
      <AvatarWithFallback 
        avatarConfig={avatarConfig}
        avatarUrl={avatarUrl}
        nick={nick}
        size={48}
      />
    </div>
  );
};

export default UserMarker;


