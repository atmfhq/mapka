import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface InstallPromptProps {
  onClose?: () => void;
}

const InstallPrompt = ({ onClose }: InstallPromptProps) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();

  if (isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    await promptInstall();
    onClose?.();
  };

  // iOS instructions
  if (isIOS) {
    return (
      <div className="p-4 rounded-lg bg-card border border-primary/30 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-orbitron text-sm font-bold flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            Install App
          </h3>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          To install SquadMap on your iPhone:
        </p>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li className="flex items-center gap-2">
            Tap the <Share className="w-4 h-4 inline" /> Share button
          </li>
          <li>Scroll down and tap "Add to Home Screen"</li>
          <li>Tap "Add" to confirm</li>
        </ol>
      </div>
    );
  }

  // Android/Desktop install button
  if (isInstallable) {
    return (
      <Button
        onClick={handleInstall}
        variant="outline"
        className="w-full justify-start gap-3 border-primary/30 hover:bg-primary/10 min-h-[48px]"
      >
        <Download className="w-5 h-5 text-primary" />
        <span className="font-medium">Install App</span>
      </Button>
    );
  }

  return null;
};

export default InstallPrompt;
