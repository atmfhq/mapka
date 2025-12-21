import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import AvatarDisplay from "./AvatarDisplay";
import { 
  SKIN_COLORS, 
  SKIN_COLOR_VALUES, 
  SHAPES, 
  EYES, 
  MOUTHS,
  DEFAULT_AVATAR_CONFIG 
} from "./avatarParts";
import { Palette, Shapes, Eye, Smile } from "lucide-react";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface AvatarBuilderProps {
  initialConfig?: AvatarConfig | null;
  onChange: (config: AvatarConfig) => void;
}

const AvatarBuilder = ({ initialConfig, onChange }: AvatarBuilderProps) => {
  const [config, setConfig] = useState<AvatarConfig>({
    skinColor: initialConfig?.skinColor || DEFAULT_AVATAR_CONFIG.skinColor,
    shape: initialConfig?.shape || DEFAULT_AVATAR_CONFIG.shape,
    eyes: initialConfig?.eyes || DEFAULT_AVATAR_CONFIG.eyes,
    mouth: initialConfig?.mouth || DEFAULT_AVATAR_CONFIG.mouth,
  });

  useEffect(() => {
    if (initialConfig) {
      setConfig({
        skinColor: initialConfig.skinColor || DEFAULT_AVATAR_CONFIG.skinColor,
        shape: initialConfig.shape || DEFAULT_AVATAR_CONFIG.shape,
        eyes: initialConfig.eyes || DEFAULT_AVATAR_CONFIG.eyes,
        mouth: initialConfig.mouth || DEFAULT_AVATAR_CONFIG.mouth,
      });
    }
  }, [initialConfig]);

  const updateConfig = (key: keyof AvatarConfig, value: string) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onChange(newConfig);
  };

  const OptionButton = ({ 
    selected, 
    onClick, 
    children,
    color
  }: { 
    selected: boolean; 
    onClick: () => void; 
    children: React.ReactNode;
    color?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative p-3 rounded-lg border-2 transition-all duration-200
        ${selected 
          ? "border-primary bg-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.3)]" 
          : "border-border/50 bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
        }
      `}
      style={color ? { 
        background: selected ? `${color}30` : undefined,
        borderColor: selected ? color : undefined,
      } : undefined}
    >
      {children}
      {selected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Avatar Preview */}
      <div className="flex justify-center py-6">
        <div className="relative">
          <AvatarDisplay config={config} size={160} showGlow />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-card border border-border/50 font-mono text-xs text-muted-foreground">
            PREVIEW
          </div>
        </div>
      </div>

      {/* Customization Tabs */}
      <Tabs defaultValue="color" className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-muted/50">
          <TabsTrigger value="color" className="gap-1.5 text-xs">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Color</span>
          </TabsTrigger>
          <TabsTrigger value="shape" className="gap-1.5 text-xs">
            <Shapes className="w-4 h-4" />
            <span className="hidden sm:inline">Shape</span>
          </TabsTrigger>
          <TabsTrigger value="eyes" className="gap-1.5 text-xs">
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Eyes</span>
          </TabsTrigger>
          <TabsTrigger value="mouth" className="gap-1.5 text-xs">
            <Smile className="w-4 h-4" />
            <span className="hidden sm:inline">Mouth</span>
          </TabsTrigger>
        </TabsList>

        {/* Color Selection */}
        <TabsContent value="color" className="mt-4">
          <Label className="font-mono text-xs uppercase text-muted-foreground mb-3 block">
            Skin Color
          </Label>
          <div className="grid grid-cols-4 gap-3">
            {SKIN_COLORS.map((c) => (
              <OptionButton
                key={c.id}
                selected={config.skinColor === c.id}
                onClick={() => updateConfig("skinColor", c.id)}
                color={SKIN_COLOR_VALUES[c.id]}
              >
                <div 
                  className="w-10 h-10 rounded-lg mx-auto"
                  style={{ 
                    backgroundColor: SKIN_COLOR_VALUES[c.id],
                    boxShadow: config.skinColor === c.id 
                      ? `0 0 20px ${SKIN_COLOR_VALUES[c.id]}` 
                      : undefined
                  }}
                />
                <div className="text-xs mt-2 font-medium text-center">{c.label}</div>
              </OptionButton>
            ))}
          </div>
        </TabsContent>

        {/* Shape Selection */}
        <TabsContent value="shape" className="mt-4">
          <Label className="font-mono text-xs uppercase text-muted-foreground mb-3 block">
            Head Shape
          </Label>
          <div className="grid grid-cols-4 gap-3">
            {SHAPES.map((s) => (
              <OptionButton
                key={s.id}
                selected={config.shape === s.id}
                onClick={() => updateConfig("shape", s.id)}
              >
                <AvatarDisplay 
                  config={{ ...config, shape: s.id }} 
                  size={48} 
                  showGlow={false}
                />
                <div className="text-xs mt-2 font-medium text-center">{s.label}</div>
              </OptionButton>
            ))}
          </div>
        </TabsContent>

        {/* Eyes Selection */}
        <TabsContent value="eyes" className="mt-4">
          <Label className="font-mono text-xs uppercase text-muted-foreground mb-3 block">
            Eyes Style
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {EYES.map((e) => (
              <OptionButton
                key={e.id}
                selected={config.eyes === e.id}
                onClick={() => updateConfig("eyes", e.id)}
              >
                <AvatarDisplay 
                  config={{ ...config, eyes: e.id }} 
                  size={48} 
                  showGlow={false}
                />
                <div className="text-xs mt-2 font-medium text-center">{e.label}</div>
              </OptionButton>
            ))}
          </div>
        </TabsContent>

        {/* Mouth Selection */}
        <TabsContent value="mouth" className="mt-4">
          <Label className="font-mono text-xs uppercase text-muted-foreground mb-3 block">
            Mouth Style
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {MOUTHS.map((m) => (
              <OptionButton
                key={m.id}
                selected={config.mouth === m.id}
                onClick={() => updateConfig("mouth", m.id)}
              >
                <AvatarDisplay 
                  config={{ ...config, mouth: m.id }} 
                  size={48} 
                  showGlow={false}
                />
                <div className="text-xs mt-2 font-medium text-center">{m.label}</div>
              </OptionButton>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AvatarBuilder;
