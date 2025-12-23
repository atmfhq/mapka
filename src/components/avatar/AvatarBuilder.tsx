import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import AvatarDisplay from "./AvatarDisplay";
import { 
  PRESET_COLORS,
  SHAPES, 
  EYES, 
  MOUTHS,
  DEFAULT_AVATAR_CONFIG,
  resolveColor 
} from "./avatarParts";
import { 
  AVAILABLE_EYES, 
  AVAILABLE_MOUTHS, 
  getAssetDisplayName 
} from "@/config/avatarAssets";
import { Palette, Shapes, Eye, Smile, Pipette } from "lucide-react";

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
    skinColor: resolveColor(initialConfig?.skinColor) || DEFAULT_AVATAR_CONFIG.skinColor,
    shape: initialConfig?.shape || DEFAULT_AVATAR_CONFIG.shape,
    eyes: initialConfig?.eyes || DEFAULT_AVATAR_CONFIG.eyes,
    mouth: initialConfig?.mouth || DEFAULT_AVATAR_CONFIG.mouth,
  });

  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setConfig({
        skinColor: resolveColor(initialConfig.skinColor) || DEFAULT_AVATAR_CONFIG.skinColor,
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

  const handleColorChange = (hex: string) => {
    updateConfig("skinColor", hex.toUpperCase());
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

  const currentColor = config.skinColor || DEFAULT_AVATAR_CONFIG.skinColor;

  return (
    <div className="space-y-6">
      {/* Avatar Preview */}
      <div className="flex justify-center py-6">
        <div className="relative">
          <AvatarDisplay config={config} size={160} showGlow />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-card border-2 border-border font-nunito text-xs text-muted-foreground shadow-hard-sm">
            Preview
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
        <TabsContent value="color" className="mt-4 space-y-4">
          <Label className="font-nunito text-sm font-medium text-foreground mb-3 block">
            Choose Your Color
          </Label>
          
          {/* Color Picker */}
          <div className="flex items-center gap-4">
            <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-14 relative overflow-hidden border-2 hover:border-primary/50"
                  style={{ 
                    background: `linear-gradient(135deg, ${currentColor}40 0%, ${currentColor}20 100%)`,
                    borderColor: currentColor 
                  }}
                >
                  <div 
                    className="absolute left-4 w-10 h-10 rounded-lg shadow-lg"
                    style={{ backgroundColor: currentColor }}
                  />
                  <div className="ml-12 flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">Selected Color</span>
                    <span className="font-nunito text-sm font-medium">{currentColor}</span>
                  </div>
                  <Pipette className="absolute right-4 w-5 h-5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" align="center">
                <div className="space-y-4">
                  <Label className="font-nunito text-sm font-medium text-foreground">
                    Pick Any Color
                  </Label>
                  
                  {/* Native Color Picker */}
                  <div className="relative">
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-full h-32 rounded-lg cursor-pointer border-2 border-border/50 hover:border-primary/50 transition-colors"
                      style={{ 
                        backgroundColor: 'transparent',
                      }}
                    />
                  </div>
                  
                  {/* Hex Input */}
                  <div className="flex gap-2">
                    <Input
                      value={currentColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          if (val.length === 7) {
                            handleColorChange(val);
                          } else {
                            setConfig(prev => ({ ...prev, skinColor: val }));
                          }
                        }
                      }}
                      placeholder="#FFFFFF"
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Preset Colors */}
          <div>
            <Label className="font-nunito text-sm font-medium text-foreground mb-3 block">
              Quick Presets
            </Label>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleColorChange(c.hex)}
                  className={`
                    w-full aspect-square rounded-lg transition-all duration-200 
                    hover:scale-110 hover:shadow-lg
                    ${currentColor === c.hex ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''}
                  `}
                  style={{ 
                    backgroundColor: c.hex,
                    boxShadow: currentColor === c.hex ? `0 0 20px ${c.hex}` : undefined
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Shape Selection */}
        <TabsContent value="shape" className="mt-4">
          <Label className="font-nunito text-sm font-medium text-foreground mb-3 block">
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

        {/* Eyes Selection - Scrollable Grid */}
        <TabsContent value="eyes" className="mt-4">
          <Label className="font-nunito text-sm font-medium text-foreground mb-3 block">
            Eyes Style ({AVAILABLE_EYES.length} options)
          </Label>
          <ScrollArea className="h-64 rounded-lg border border-border/50 bg-muted/20 p-2">
            <div className="grid grid-cols-4 gap-2">
              {AVAILABLE_EYES.map((filename) => (
                <OptionButton
                  key={filename}
                  selected={config.eyes === filename}
                  onClick={() => updateConfig("eyes", filename)}
                >
                  <AvatarDisplay 
                    config={{ ...config, eyes: filename }} 
                    size={40} 
                    showGlow={false}
                  />
                  <div className="text-[10px] mt-1 font-medium text-center truncate w-full">
                    {getAssetDisplayName(filename)}
                  </div>
                </OptionButton>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Mouth Selection - Scrollable Grid */}
        <TabsContent value="mouth" className="mt-4">
          <Label className="font-nunito text-sm font-medium text-foreground mb-3 block">
            Mouth Style ({AVAILABLE_MOUTHS.length} options)
          </Label>
          <ScrollArea className="h-64 rounded-lg border border-border/50 bg-muted/20 p-2">
            <div className="grid grid-cols-4 gap-2">
              {AVAILABLE_MOUTHS.map((filename) => (
                <OptionButton
                  key={filename}
                  selected={config.mouth === filename}
                  onClick={() => updateConfig("mouth", filename)}
                >
                  <AvatarDisplay 
                    config={{ ...config, mouth: filename }} 
                    size={40} 
                    showGlow={false}
                  />
                  <div className="text-[10px] mt-1 font-medium text-center truncate w-full">
                    {getAssetDisplayName(filename)}
                  </div>
                </OptionButton>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AvatarBuilder;
