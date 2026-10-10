import Image from 'next/image';

import { APP_NAME, APP_TAGLINE, BRAND_ASSET, LOGO_ASPECT } from '@/lib/constants/pwa.constants';
import { cn } from '@/lib/utils';

export function Logo({ inverse = false, height = 32, priority = false, className }: { inverse?: boolean; height?: number; priority?: boolean; className?: string }) {
  return (
    <Image
      src={inverse ? BRAND_ASSET.logoWhite : BRAND_ASSET.logo}
      alt={`${APP_NAME} — ${APP_TAGLINE}`}
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      priority={priority}
      draggable={false}
      className={cn('w-auto max-w-full shrink-0 select-none', className)}
      style={{ height, width: 'auto' }}
    />
  );
}

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src={BRAND_ASSET.mark} alt="" width={size} height={size} draggable={false} className={cn('shrink-0 select-none', className)} style={{ width: size, height: size }} />;
}
