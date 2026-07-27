import { useRef, useState } from "react";
import { Camera, Check, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AccountAvatar } from "@/components/account-avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  prepareProfilePhoto,
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_TYPES,
} from "@/lib/profile-photo";
import { supabase } from "@/integrations/supabase/client";

export function ProfilePhotoEditor({
  name,
  imageUrl,
}: {
  name?: string | null;
  imageUrl?: string | null;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    if (!PROFILE_PHOTO_TYPES.includes(file.type)) {
      toast.error(t("profile.photo.errors.type"));
      return;
    }
    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      toast.error(t("profile.photo.errors.size"));
      return;
    }
    setProcessing(true);
    try {
      setPreview(await prepareProfilePhoto(file));
    } catch {
      toast.error(t("profile.photo.errors.processing"));
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const savePhoto = async () => {
    if (!user || !preview) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        avatar_url: preview,
        avatar_removed: false,
      },
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || t("profile.photo.errors.save"));
      return;
    }
    setPreview(null);
    toast.success(t("profile.photo.saved"));
  };

  const removePhoto = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        avatar_url: null,
        avatar_removed: true,
      },
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || t("profile.photo.errors.remove"));
      return;
    }
    setPreview(null);
    toast.success(t("profile.photo.removed"));
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <AccountAvatar
        name={name}
        imageUrl={preview ?? imageUrl}
        className="h-24 w-24 shrink-0 shadow-sm"
        imageClassName="aspect-square"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{t("profile.photo.description")}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("profile.photo.hint")}</p>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={PROFILE_PHOTO_TYPES.join(",")}
          onChange={(event) => void choosePhoto(event.target.files?.[0])}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={processing || saving}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {processing ? t("profile.photo.processing") : t("profile.photo.upload")}
          </Button>
          {preview ? (
            <>
              <Button
                type="button"
                className="min-h-11"
                disabled={saving}
                onClick={() => void savePhoto()}
              >
                <Check className="h-4 w-4" />
                {saving ? t("common.loading") : t("profile.photo.save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={saving}
                onClick={() => setPreview(null)}
              >
                <RotateCcw className="h-4 w-4" />
                {t("common.cancel")}
              </Button>
            </>
          ) : imageUrl ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-destructive hover:text-destructive"
              disabled={saving}
              onClick={() => void removePhoto()}
            >
              <Trash2 className="h-4 w-4" />
              {t("profile.photo.remove")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
