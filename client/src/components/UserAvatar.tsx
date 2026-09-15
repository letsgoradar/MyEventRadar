import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserRound } from "lucide-react";

interface UserAvatarProps {
  user?: { photoUrl?: string | null; avatar?: string | null; username?: string | null; name?: string | null } | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  alt?: string;
}

export function UserAvatar({ user, src, size = "md", className, alt = "Profiel" }: UserAvatarProps) {
  const photo = src || user?.photoUrl || user?.avatar;
  const name = user?.name || user?.username || "";
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const sizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-20 w-20" };
  return (
    <Avatar className={`${sizes[size]} ${className || ""}`}>
      {photo ? <AvatarImage src={photo} alt={alt} /> : <AvatarFallback className="bg-primary/10 text-primary">
        {initials || <UserRound className={size === "lg" ? "h-9 w-9" : "h-5 w-5"} />}
      </AvatarFallback>}
    </Avatar>
  );
}