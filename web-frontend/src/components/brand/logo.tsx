import Image from 'next/image';

import { APP_NAME, APP_TAGLINE, BRAND_ASSET, LOGO_ASPECT } from '@/lib/constants/pwa.constants';
import { cn } from '@/lib/utils';

export function Logo({ inverse = false, height = 32, priority = false, className }: { inverse?: boolean; height?: number; priority?: boolean; className?: string }) {
  const width = Math.round(height * (inverse ? LOGO_ASPECT.logoWhite : LOGO_ASPECT.logo));
  return (
    <Image
      src={inverse ? BRAND_ASSET.logoWhite : BRAND_ASSET.logo}
      alt={`${APP_NAME} — ${APP_TAGLINE}`}
      width={width}
      height={height}
      priority={priority}
      draggable={false}
      className={cn('max-w-full shrink-0 object-contain select-none', className)}
      style={{ height, width }}
    />
  );
}

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src={BRAND_ASSET.mark} alt="" width={size} height={size} loading="eager" draggable={false} className={cn('shrink-0 select-none', className)} style={{ width: size, height: size }} />;
}
