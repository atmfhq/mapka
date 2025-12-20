// This component is used for reference - actual markers are created via DOM in TacticalMap
// Keeping for potential future React-based marker implementation

interface UserMarkerProps {
  avatarUrl: string | null;
  nick: string | null;
}

const UserMarker = ({ avatarUrl, nick }: UserMarkerProps) => {
  return (
    <div className="relative w-12 h-12 cursor-pointer group">
      <div className="absolute inset-0 rounded-full border-2 border-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)] animate-pulse" />
      <img 
        src={avatarUrl || '/placeholder.svg'} 
        alt={nick || 'User'}
        className="absolute inset-1 w-10 h-10 rounded-full object-cover bg-background"
      />
    </div>
  );
};

export default UserMarker;

