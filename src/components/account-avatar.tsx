import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/account-identity";
import { cn } from "@/lib/utils";

export function AccountAvatar({
  name,
  imageUrl,
  className,
  imageClassName,
}: {
  name?: string | null;
  imageUrl?: string | null;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <Avatar
      className={cn("h-9 w-9 border border-border bg-card", className)}
      aria-label={name || undefined}
    >
      {imageUrl ? (
        <AvatarImage
          src={imageUrl}
          alt={name ?? ""}
          className={cn("object-cover", imageClassName)}
        />
      ) : null}
      <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
