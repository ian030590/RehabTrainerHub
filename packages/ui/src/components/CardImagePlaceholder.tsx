import type { ImgHTMLAttributes } from 'react';

export const cardImagePlaceholderSrc = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none"%3E%3Crect width="640" height="360" fill="%23E8ECEA"/%3E%3Cpath d="M0 262 154 126l100 90 78-69 308 273H0V262Z" fill="%23C7D5CD"/%3E%3Ccircle cx="481" cy="105" r="42" fill="%23B0C9BB"/%3E%3Cpath d="M0 297 184 173l92 78 65-52 299 221H0V297Z" fill="%2398B8A7" fill-opacity=".72"/%3E%3C/svg%3E';

export interface CardImagePlaceholderProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {}

export function CardImagePlaceholder({
  alt = '',
  className = '',
  ...props
}: CardImagePlaceholderProps) {
  return (
    <img
      {...props}
      alt={alt}
      className={`card-image-placeholder ${className}`.trim()}
      src={cardImagePlaceholderSrc}
    />
  );
}
