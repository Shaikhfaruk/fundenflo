import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants/pwa.constants';

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="512" height="512" rx="120" className="fill-primary" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M168 380V148h168M168 260h112" className="stroke-primary-foreground" strokeWidth="52" />
        <path d="M262 372c48-8 88-44 104-104M332 262l36-14 14 36" stroke="#8ee6bf" strokeWidth="32" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark />
      <span className="text-lg">{APP_NAME}</span>
    </span>
  );
}
