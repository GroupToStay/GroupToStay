import type { ImgHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const HOTEL_PHOTOS_BUCKET = "hotel-photos";

function getHotelPhotoPath(value?: string | null): string | null {
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "");
  }

  try {
    const url = new URL(value);
    const markers = [
      `/storage/v1/object/public/${HOTEL_PHOTOS_BUCKET}/`,
      `/storage/v1/object/sign/${HOTEL_PHOTOS_BUCKET}/`,
    ];

    for (const marker of markers) {
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        return decodeURIComponent(url.pathname.slice(index + marker.length));
      }
    }
  } catch {
    return null;
  }

  return null;
}

type HotelPhotoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallback?: ReactNode;
};

export function HotelPhoto({
  src,
  fallback = null,
  decoding = "async",
  ...props
}: HotelPhotoProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() =>
    getHotelPhotoPath(src) ? null : (src ?? null),
  );

  useEffect(() => {
    let cancelled = false;
    const path = getHotelPhotoPath(src);

    setResolvedSrc(path ? null : (src ?? null));

    if (!src || !path) return;

    supabase.storage
      .from(HOTEL_PHOTOS_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.signedUrl) {
          setResolvedSrc(data.signedUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src) return <>{fallback}</>;
  if (!resolvedSrc) return <>{fallback}</>;

  return <img {...props} decoding={decoding} src={resolvedSrc} />;
}
