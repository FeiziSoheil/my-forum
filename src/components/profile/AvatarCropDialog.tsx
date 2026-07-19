'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { getCroppedImageFile, type CropOutputOptions } from '@/lib/cropImage';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type AvatarCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  fileName?: string;
  title?: string;
  description?: string;
  aspect?: number;
  cropShape?: 'rect' | 'round';
  outputSize?: CropOutputOptions;
  onOpenChange: (open: boolean) => void;
  onCropComplete: (file: File, previewUrl: string) => void;
};

export function AvatarCropDialog({
  open,
  imageSrc,
  fileName = 'avatar.jpg',
  title = 'Crop profile photo',
  description = 'Drag to reposition and zoom to frame your photo. It will be saved as a square.',
  aspect = 1,
  cropShape = 'round',
  outputSize,
  onOpenChange,
  onCropComplete,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const resetState = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsProcessing(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels, fileName, outputSize);
      const previewUrl = URL.createObjectURL(file);
      onCropComplete(file, previewUrl);
      handleOpenChange(false);
    } catch {
      toast.error('Failed to crop image. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={aspect > 1 ? 'sm:max-w-lg' : 'sm:max-w-md'}
        showCloseButton={!isProcessing}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div
          className={`relative w-full overflow-hidden rounded-md bg-muted ${
            aspect > 1 ? 'h-48 sm:h-56' : 'h-72'
          }`}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="image-zoom">Zoom</Label>
          <Slider
            id="image-zoom"
            min={1}
            max={3}
            step={0.05}
            value={[zoom]}
            onValueChange={(value) => setZoom(value[0] ?? 1)}
            disabled={isProcessing}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isProcessing || !croppedAreaPixels}>
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Cropping...
              </>
            ) : (
              'Apply'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
