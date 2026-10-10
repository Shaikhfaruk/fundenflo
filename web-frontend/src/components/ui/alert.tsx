import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border border-transparent p-3 text-left text-[13px] has-data-[slot=alert-action]:grid-cols-[1fr_auto] has-data-[slot=alert-action]:gap-x-2 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:has-data-[slot=alert-action]:grid-cols-[auto_1fr_auto] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        info: "bg-info-soft text-info *:data-[slot=alert-description]:text-[#2c4670]",
        gold: "bg-gold-soft text-[#5d4200] *:data-[slot=alert-description]:text-[#5d4200]/85",
        success: "bg-success-soft text-success *:data-[slot=alert-description]:text-success/90",
        destructive:
          "bg-[#fff8f7] border-error-soft text-destructive *:data-[slot=alert-description]:text-destructive/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-semibold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-[13px] text-pretty text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("col-start-[-2] row-span-2 row-start-1 self-start", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
