'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarCropDialog } from '@/components/profile/AvatarCropDialog';
import { useMe } from '@/hook/useMe';
import { useUpdateProfile } from '@/hook/useUpdateProfile';
import { toast } from 'sonner';
import { Camera, ImageIcon, Loader2 } from 'lucide-react';

const MAX_BIO = 160;
const MAX_LOCATION = 100;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Standard profile banner aspect (3:1), e.g. 1500×500. */
const BANNER_ASPECT = 3;
const BANNER_OUTPUT = { width: 1500, height: 500 };

const profileSchema = z.object({
  fullname: z.string().min(3, 'Fullname must be at least 3 characters'),
  bio: z.string().max(MAX_BIO, `Bio cannot exceed ${MAX_BIO} characters`).optional(),
  location: z.string().max(MAX_LOCATION, `Location cannot exceed ${MAX_LOCATION} characters`).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type CropTarget = 'avatar' | 'banner';

export function ProfileEditForm() {
  const { data: user } = useMe();
  const updateProfile = useUpdateProfile();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<CropTarget>('avatar');
  const cropTargetRef = useRef<CropTarget>('avatar');
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('avatar.jpg');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullname: '', bio: '', location: '' },
  });

  useEffect(() => {
    if (user) {
      reset({ fullname: user.fullname ?? '', bio: user.bio ?? '', location: user.location ?? '' });
    }
  }, [user, reset]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    return () => {
      if (bannerPreview?.startsWith('blob:')) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  useEffect(() => {
    return () => {
      if (cropImageSrc?.startsWith('blob:')) URL.revokeObjectURL(cropImageSrc);
    };
  }, [cropImageSrc]);

  const bio = watch('bio') ?? '';
  const fullname = watch('fullname') ?? '';

  const openCropForFile = (file: File, target: CropTarget) => {
    if (!file.type.startsWith('image/')) {
      toast.error(target === 'banner' ? 'Banner must be an image' : 'Avatar must be an image');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(
        target === 'banner'
          ? 'Banner is too large. Maximum size is 10MB'
          : 'Avatar is too large. Maximum size is 10MB'
      );
      return;
    }

    cropTargetRef.current = target;
    setCropTarget(target);
    setCropFileName(file.name);
    setCropImageSrc(URL.createObjectURL(file));
    setCropOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    openCropForFile(file, 'avatar');
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    openCropForFile(file, 'banner');
  };

  const handleCropComplete = (file: File, previewUrl: string) => {
    if (cropTargetRef.current === 'banner') {
      setBannerFile(file);
      setBannerPreview(previewUrl);
    } else {
      setAvatarFile(file);
      setAvatarPreview(previewUrl);
    }
    setCropImageSrc(null);
  };

  const handleCropOpenChange = (open: boolean) => {
    setCropOpen(open);
    if (!open) {
      setCropImageSrc(null);
    }
  };

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(
      {
        fullname: data.fullname,
        bio: data.bio ?? '',
        location: data.location ?? '',
        avatar: avatarFile,
        banner: bannerFile,
      },
      {
        onSuccess: () => {
          toast.success('Profile updated successfully');
          setAvatarFile(null);
          setAvatarPreview(null);
          setBannerFile(null);
          setBannerPreview(null);
        },
        onError: (error) => {
          const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast.error(message || 'Failed to update profile');
        },
      }
    );
  };

  const previewSrc = avatarPreview || user?.avatar || undefined;
  const bannerSrc = bannerPreview || user?.banner || undefined;

  const isBannerCrop = cropTarget === 'banner';

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label>Banner</Label>
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
            <div className="relative aspect-[3/1] w-full">
              {bannerSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerSrc} alt="Profile banner preview" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-background">
                  <ImageIcon className="size-8 text-muted-foreground/50" />
                </div>
              )}
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/35 focus-visible:bg-black/35 focus-visible:outline-none"
                aria-label="Change banner photo"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm opacity-90">
                  <Camera className="size-3.5" />
                  Change banner
                </span>
              </button>
            </div>
            <Input
              ref={bannerInputRef}
              id="banner"
              type="file"
              accept="image/*"
              onChange={handleBannerChange}
              className="hidden"
            />
          </div>
          <p className="text-xs text-muted-foreground">PNG or JPG, up to 10MB. Cropped to 3:1.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src={previewSrc} />
              <AvatarFallback />
            </Avatar>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid place-items-center size-8 rounded-full bg-primary text-primary-foreground shadow cursor-pointer hover:opacity-90 transition-opacity"
              aria-label="Change profile photo"
            >
              <Camera className="w-4 h-4" />
            </button>
            <Input
              ref={avatarInputRef}
              id="avatar"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground">PNG or JPG, up to 10MB</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullname">Full name</Label>
          <Input id="fullname" {...register('fullname')} placeholder="Your full name" />
          {errors.fullname && (
            <p className="text-sm text-destructive">{errors.fullname.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={4}
            maxLength={MAX_BIO}
            {...register('bio')}
            placeholder="Tell us about yourself..."
          />
          <div className="flex items-center justify-between">
            {errors.bio ? (
              <p className="text-sm text-destructive">{errors.bio.message}</p>
            ) : (
              <span />
            )}
            <p className="text-xs text-muted-foreground">
              {bio.length} / {MAX_BIO}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            maxLength={MAX_LOCATION}
            {...register('location')}
            placeholder="Where are you based?"
          />
          {errors.location && (
            <p className="text-sm text-destructive">{errors.location.message}</p>
          )}
        </div>

        <Button type="submit" disabled={updateProfile.isPending} className="w-full">
          {updateProfile.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </form>

      <AvatarCropDialog
        key={cropTarget}
        open={cropOpen}
        imageSrc={cropImageSrc}
        fileName={cropFileName}
        title={isBannerCrop ? 'Crop banner' : 'Crop profile photo'}
        description={
          isBannerCrop
            ? 'Drag to reposition and zoom to frame your banner. It will be saved as a wide 3:1 image.'
            : 'Drag to reposition and zoom to frame your photo. It will be saved as a square.'
        }
        aspect={isBannerCrop ? BANNER_ASPECT : 1}
        cropShape={isBannerCrop ? 'rect' : 'round'}
        outputSize={isBannerCrop ? BANNER_OUTPUT : undefined}
        onOpenChange={handleCropOpenChange}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}
