import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  aspectRatio?: number;
}

// Helper function to create cropped image
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputSize: number = 512
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // Set canvas to desired output size (square)
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Draw the cropped image onto the canvas, scaling to output size
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  // Return as data URL
  return canvas.toDataURL('image/jpeg', 0.9);
}

const ImageCropper = ({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio = 4/3, // Default to 4:3 landscape
}: ImageCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropAreaChange = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    
    setIsProcessing(true);
    try {
      const croppedImageUrl = await getCroppedImg(imageSrc, croppedAreaPixels, 512);
      onCropComplete(croppedImageUrl);
      onOpenChange(false);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30 max-w-md w-[calc(100vw-2rem)] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="font-fredoka text-lg">Crop Image (4:3)</DialogTitle>
          <p className="text-xs text-muted-foreground font-nunito">
            Drag to position, scroll or use slider to zoom
          </p>
        </DialogHeader>

        {/* Cropper container - height adjusted for 4:3 aspect ratio */}
        <div className="relative w-full h-72 bg-black/90">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaChange}
            cropShape="rect"
            showGrid={true}
            style={{
              containerStyle: {
                backgroundColor: 'rgba(0,0,0,0.9)',
              },
              cropAreaStyle: {
                border: '2px solid hsl(var(--primary))',
                borderRadius: '8px',
              },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter className="p-4 pt-0 gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processing...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;
