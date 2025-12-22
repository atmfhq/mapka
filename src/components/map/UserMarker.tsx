// This component is used for reference - actual markers are created via DOM in TacticalMap
// Keeping for potential future React-based marker implementation

interface UserMarkerProps {
  avatarUrl: string | null;
  nick: string | null;
}

const UserMarker = ({ avatarUrl, nick }: UserMarkerProps) => {
  return (
    <div className="relative w-12 h-12 cursor-pointer group">
      <img 
        src={avatarUrl || '/placeholder.svg'} 
        alt={nick || 'User'}
        className="w-12 h-12 rounded-xl object-cover bg-background"
      />
    </div>
  );
};

export default UserMarker;

