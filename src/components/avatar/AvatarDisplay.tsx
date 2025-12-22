import { resolveColor, darkenHexColor, DEFAULT_AVATAR_CONFIG } from "./avatarParts";
import { AVAILABLE_EYES, AVAILABLE_MOUTHS, getEyeAssetPath, getMouthAssetPath } from "@/config/avatarAssets";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

// Check if an eye ID corresponds to a PNG asset file
const isEyeAsset = (eyeId: string): boolean => {
  const result = AVAILABLE_EYES.includes(eyeId);
  console.log(`[Avatar] isEyeAsset check: "${eyeId}" -> ${result}`);
  return result;
};

// Check if a mouth ID corresponds to a PNG asset file
const isMouthAsset = (mouthId: string): boolean => {
  const result = AVAILABLE_MOUTHS.includes(mouthId);
  console.log(`[Avatar] isMouthAsset check: "${mouthId}" -> ${result}`);
  return result;
};

// Get the full path for an eye asset
const getEyePath = (eyeId: string): string | null => {
  if (AVAILABLE_EYES.includes(eyeId)) {
    const path = getEyeAssetPath(eyeId);
    console.log(`[Avatar] Eye path constructed: "${path}"`);
    return path;
  }
  return null;
};

// Get the full path for a mouth asset
const getMouthPath = (mouthId: string): string | null => {
  if (AVAILABLE_MOUTHS.includes(mouthId)) {
    const path = getMouthAssetPath(mouthId);
    console.log(`[Avatar] Mouth path constructed: "${path}"`);
    return path;
  }
  return null;
};

interface AvatarDisplayProps {
  config: AvatarConfig | null;
  size?: number;
  className?: string;
  showGlow?: boolean;
}

const AvatarDisplay = ({ 
  config, 
  size = 120, 
  className = "",
  showGlow = false 
}: AvatarDisplayProps) => {
  const cfg = {
    skinColor: config?.skinColor || DEFAULT_AVATAR_CONFIG.skinColor,
    shape: config?.shape || DEFAULT_AVATAR_CONFIG.shape,
    eyes: config?.eyes || DEFAULT_AVATAR_CONFIG.eyes,
    mouth: config?.mouth || DEFAULT_AVATAR_CONFIG.mouth,
  };

  // Resolve color (handles both legacy IDs and hex values)
  const color = resolveColor(cfg.skinColor);
  const darkerColor = darkenHexColor(color, 15);

  // Base shape path/element
  const renderShape = () => {
    const shapeProps = {
      fill: color,
      stroke: darkerColor,
      strokeWidth: 3,
    };

    switch (cfg.shape) {
      case "circle":
        return <circle cx="60" cy="60" r="55" {...shapeProps} />;
      case "squircle":
        return (
          <rect 
            x="5" y="5" 
            width="110" height="110" 
            rx="30" ry="30" 
            {...shapeProps} 
          />
        );
      case "square":
        return (
          <rect 
            x="5" y="5" 
            width="110" height="110" 
            rx="10" ry="10" 
            {...shapeProps} 
          />
        );
      case "hexagon":
        return (
          <polygon 
            points="60,5 110,30 110,90 60,115 10,90 10,30" 
            {...shapeProps} 
          />
        );
      default:
        return <circle cx="60" cy="60" r="55" {...shapeProps} />;
    }
  };

  // Eyes SVG paths or PNG images
  const renderEyes = () => {
    const eyeColor = "#0a0a0a";
    
    // Check if this is a PNG asset
    if (isEyeAsset(cfg.eyes)) {
      const path = getEyePath(cfg.eyes);
      if (path) {
        return (
          <image 
            href={path} 
            x="10" 
            y="25" 
            width="100" 
            height="50" 
            preserveAspectRatio="xMidYMid meet"
          />
        );
      }
    }
    
    // Fallback to SVG eyes
    switch (cfg.eyes) {
      case "normal":
        return (
          <>
            <circle cx="40" cy="50" r="8" fill={eyeColor} />
            <circle cx="80" cy="50" r="8" fill={eyeColor} />
            <circle cx="42" cy="48" r="3" fill="white" />
            <circle cx="82" cy="48" r="3" fill="white" />
          </>
        );
      case "happy":
        return (
          <>
            <path d="M32 50 Q40 42 48 50" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M72 50 Q80 42 88 50" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        );
      case "angry":
        return (
          <>
            <circle cx="40" cy="52" r="7" fill={eyeColor} />
            <circle cx="80" cy="52" r="7" fill={eyeColor} />
            <line x1="30" y1="40" x2="50" y2="46" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="90" y1="40" x2="70" y2="46" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
          </>
        );
      case "glasses":
        return (
          <>
            <circle cx="40" cy="50" r="14" fill="none" stroke={eyeColor} strokeWidth="3" />
            <circle cx="80" cy="50" r="14" fill="none" stroke={eyeColor} strokeWidth="3" />
            <line x1="54" y1="50" x2="66" y2="50" stroke={eyeColor} strokeWidth="3" />
            <line x1="26" y1="50" x2="15" y2="45" stroke={eyeColor} strokeWidth="3" />
            <line x1="94" y1="50" x2="105" y2="45" stroke={eyeColor} strokeWidth="3" />
            <circle cx="40" cy="50" r="5" fill={eyeColor} />
            <circle cx="80" cy="50" r="5" fill={eyeColor} />
          </>
        );
      case "sunglasses":
        return (
          <>
            <rect x="24" y="40" width="30" height="20" rx="5" fill={eyeColor} />
            <rect x="66" y="40" width="30" height="20" rx="5" fill={eyeColor} />
            <line x1="54" y1="50" x2="66" y2="50" stroke={eyeColor} strokeWidth="3" />
            <line x1="24" y1="50" x2="10" y2="45" stroke={eyeColor} strokeWidth="3" />
            <line x1="96" y1="50" x2="110" y2="45" stroke={eyeColor} strokeWidth="3" />
          </>
        );
      case "wink":
        return (
          <>
            <circle cx="40" cy="50" r="8" fill={eyeColor} />
            <circle cx="42" cy="48" r="3" fill="white" />
            <path d="M72 50 Q80 42 88 50" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        );
      default:
        return (
          <>
            <circle cx="40" cy="50" r="8" fill={eyeColor} />
            <circle cx="80" cy="50" r="8" fill={eyeColor} />
          </>
        );
    }
  };

  // Mouth SVG paths or PNG images
  const renderMouth = () => {
    const mouthColor = "#0a0a0a";
    
    // Check if this is a PNG asset
    if (isMouthAsset(cfg.mouth)) {
      const path = getMouthPath(cfg.mouth);
      if (path) {
        return (
          <image 
            href={path} 
            x="25" 
            y="65" 
            width="70" 
            height="40" 
            preserveAspectRatio="xMidYMid meet"
          />
        );
      }
    }
    
    // Fallback to SVG mouths
    switch (cfg.mouth) {
      case "smile":
        return (
          <path 
            d="M40 78 Q60 95 80 78" 
            stroke={mouthColor} 
            strokeWidth="4" 
            fill="none" 
            strokeLinecap="round" 
          />
        );
      case "neutral":
        return (
          <line 
            x1="42" y1="82" x2="78" y2="82" 
            stroke={mouthColor} 
            strokeWidth="4" 
            strokeLinecap="round" 
          />
        );
      case "frown":
        return (
          <path 
            d="M40 88 Q60 72 80 88" 
            stroke={mouthColor} 
            strokeWidth="4" 
            fill="none" 
            strokeLinecap="round" 
          />
        );
      case "open":
        return (
          <ellipse 
            cx="60" cy="82" rx="12" ry="10" 
            fill={mouthColor}
          />
        );
      case "smirk":
        return (
          <path 
            d="M45 80 Q65 90 80 78" 
            stroke={mouthColor} 
            strokeWidth="4" 
            fill="none" 
            strokeLinecap="round" 
          />
        );
      case "teeth":
        return (
          <>
            <path 
              d="M40 78 Q60 95 80 78" 
              stroke={mouthColor} 
              strokeWidth="4" 
              fill="none" 
              strokeLinecap="round" 
            />
            <line x1="50" y1="82" x2="50" y2="88" stroke="white" strokeWidth="3" />
            <line x1="60" y1="84" x2="60" y2="90" stroke="white" strokeWidth="3" />
            <line x1="70" y1="82" x2="70" y2="88" stroke="white" strokeWidth="3" />
          </>
        );
      default:
        return (
          <path 
            d="M40 78 Q60 95 80 78" 
            stroke={mouthColor} 
            strokeWidth="4" 
            fill="none" 
            strokeLinecap="round" 
          />
        );
    }
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Glow effect */}
      {showGlow && (
        <div 
          className="absolute inset-0 rounded-xl blur-xl opacity-40"
          style={{ backgroundColor: color }}
        />
      )}
      
      <svg 
        viewBox="0 0 120 120" 
        width={size} 
        height={size}
        className="relative z-10"
      >
        {/* Base shape */}
        {renderShape()}
        
        {/* Eyes */}
        {renderEyes()}
        
        {/* Mouth */}
        {renderMouth()}
      </svg>
    </div>
  );
};

export default AvatarDisplay;
