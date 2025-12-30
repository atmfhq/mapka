import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useConnections } from '@/hooks/useConnections';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import LoadingScreen from '@/components/LoadingScreen';

const Connections = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { connections, loading: connectionsLoading, error } = useConnections(user?.id ?? null);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="font-fredoka text-xl font-semibold">Connections</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {connectionsLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-card rounded-xl border-2 border-border">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive font-nunito">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : connections.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="space-y-3">
              {connections.map((connection) => (
                <ConnectionCard key={connection.id} user={connection} />
              ))}
            </div>
          </ScrollArea>
        )}
      </main>
    </div>
  );
};

interface ConnectionCardProps {
  user: {
    id: string;
    nick: string | null;
    avatar_url: string | null;
    avatar_config: {
      skinColor?: string;
      shape?: string;
      eyes?: string;
      mouth?: string;
    } | null;
  };
}

const ConnectionCard = ({ user }: ConnectionCardProps) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-xl border-2 border-border shadow-hard hover:border-primary/50 transition-colors">
      <AvatarDisplay config={user.avatar_config} size={48} showGlow={false} />
      <div className="flex-1 min-w-0">
        <p className="font-fredoka text-base font-medium truncate">
          {user.nick || 'Anonymous'}
        </p>
      </div>
    </div>
  );
};

const EmptyState = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      <h2 className="font-fredoka text-xl font-semibold mb-2">No Connections Yet</h2>
      <p className="font-nunito text-muted-foreground max-w-sm mb-6">
        Join spots on the map to automatically connect with their creators. Start exploring to grow your network!
      </p>
      <Button onClick={() => navigate('/')} className="gap-2">
        <Users className="w-4 h-4" />
        Explore the Map
      </Button>
    </div>
  );
};

export default Connections;
