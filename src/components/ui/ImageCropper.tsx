import { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Check, X, RotateCcw } from 'lucide-react';

interface ImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  aspectRatio?: number;
}

/**
 * Creates an HTMLImageElement from a URL
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });

/**
 * Generates a cropped image from the source based on the pixel crop area
 * Outputs a fixed-size image (e.g., 1200x900 for 4:3) to ensure consistency
 */
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth: number = 1200,
  outputHeight: number = 900
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Unable to get canvas 2d context');
  }

  // Set canvas to desired output dimensions (4:3 landscape)
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  // Draw the cropped portion of the source image onto the canvas
  // This scales the cropped area to fill the output dimensions exactly
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  // Return as high-quality JPEG data URL
  return canvas.toDataURL('image/jpeg', 0.92);
}

const ImageCropper = ({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio = 4 / 3, // Default: 4:3 Landscape
}: ImageCropperProps) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Called by react-easy-crop when crop area changes
  const handleCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  // Reset crop position and zoom
  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  // Generate cropped image and pass to parent
  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      // Calculate output dimensions based on aspect ratio
      const outputWidth = 1200;
      const outputHeight = Math.round(outputWidth / aspectRatio);
      
      const croppedImageUrl = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        outputWidth,
        outputHeight
      );
      onCropComplete(croppedImageUrl);
      onOpenChange(false);
      // Reset state for next use
      handleReset();
    } catch (error) {
      console.error('Error generating cropped image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel and close modal
  const handleCancel = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg w-[calc(100vw-2rem)] p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="font-fredoka text-lg">
            Crop Image
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-nunito">
            Drag to reposition. Pinch or use slider to zoom. The crop area is fixed to 4:3 landscape.
          </DialogDescription>
        </DialogHeader>

        {/* 
          Cropper Container
          - Uses a fixed aspect ratio container to prevent layout shifts
          - The cropper fills this container and handles its own image scaling
        */}
        <div 
          className="relative w-full bg-black"
          style={{ 
            // Container height based on a reasonable preview size
            // Using aspect-ratio ensures consistency across screen sizes
            height: 'min(60vw, 320px)'
          }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            cropShape="rect"
            showGrid={true}
            // objectFit="contain" ensures the full image is visible without distortion
            objectFit="contain"
            style={{
              containerStyle: {
                width: '100%',
                height: '100%',
                backgroundColor: '#0a0a0a',
              },
              mediaStyle: {
                // Ensures image renders at its natural aspect ratio
              },
              cropAreaStyle: {
                border: '2px solid hsl(var(--primary))',
                borderRadius: '8px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
              },
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={(value) => setZoom(value[0])}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-8 w-8 shrink-0"
              title="Reset position and zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="p-4 pt-3 gap-2 border-t border-border sm:gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            className="flex-1 sm:flex-initial"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || !croppedAreaPixels}
            className="flex-1 sm:flex-initial"
          >
            <Check className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processing...' : 'Confirm Crop'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;
