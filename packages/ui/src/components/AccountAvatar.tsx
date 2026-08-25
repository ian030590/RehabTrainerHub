import type { ReactNode } from 'react';

interface AccountAvatarProps {
  alt: string;
  avatarUrl?: string;
  className: string;
  fallback: ReactNode;
}

export function AccountAvatar({ alt, avatarUrl, className, fallback }: AccountAvatarProps) {
  const src = avatarUrl?.trim();
  return src ? <img alt={alt} className={className} src={src} /> : fallback;
}
