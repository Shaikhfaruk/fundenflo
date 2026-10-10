import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding font-sans font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform,opacity] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 active:not-disabled:scale-[0.98] disabled:pointer-events-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy text-primary-foreground shadow-button hover:bg-navy-pressed active:bg-navy-pressed disabled:bg-[#b8c0cc] disabled:shadow-none",
        gold: "bg-gold text-navy shadow-[0_6px_14px_rgba(197,155,39,0.28)] hover:brightness-105 disabled:bg-[#e8dcb8] disabled:shadow-none",
        outline: "border-border bg-card text-navy hover:bg-subtle disabled:opacity-60",
        secondary: "bg-subtle text-navy hover:bg-[#e6ebf1] disabled:opacity-60",
        ghost: "text-navy hover:bg-subtle disabled:opacity-60",
        link: "h-auto px-0 text-gold-deep underline-offset-4 hover:underline active:not-disabled:scale-100",
        destructive: "bg-error-soft text-destructive hover:bg-[#ffcdc7] disabled:opacity-60",
        hero: "bg-white/10 text-white backdrop-blur hover:bg-white/15",
      },
      size: {
        default: "h-13 px-4 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        sm: "h-10 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        xs: "h-8 rounded-md px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-14 px-4 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11 rounded-full [&_svg:not([class*='size-'])]:size-[22px]",
        "icon-sm": "size-9 rounded-full [&_svg:not([class*='size-'])]:size-5",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12 rounded-full [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
