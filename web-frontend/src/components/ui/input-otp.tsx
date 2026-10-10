"use client"

import * as React from "react"
import { cn } from "cn"
import { OTPInput, OTPInputContext } from "input-otp"

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "cn-input-otp flex w-full items-center has-disabled:opacity-60",
        containerClassName
      )}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn(
        "flex w-full items-center gap-2 has-aria-invalid:animate-shake",
        className
      )}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      data-filled={Boolean(char)}
      className={cn(
        "relative flex aspect-[0.86] max-w-14 min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-card font-sans text-xl font-semibold text-navy tabular shadow-[0_1px_2px_rgba(10,25,47,0.05)] transition-[border-color,background-color,box-shadow] duration-150 outline-none data-[filled=true]:bg-background data-[active=true]:z-10 data-[active=true]:border-navy data-[active=true]:bg-card data-[active=true]:ring-1 data-[active=true]:ring-navy data-[active=true]:ring-inset aria-invalid:border-destructive aria-invalid:bg-[#fff8f7] aria-invalid:ring-destructive",
        className
      )}
      {...props}
    >
      {char ? (
        <span key={char} className="animate-in duration-150 fade-in-0 zoom-in-90">
          {char}
        </span>
      ) : null}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-0.5 animate-caret rounded-full bg-navy" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      className="h-0.5 w-3 shrink-0 rounded-full bg-border-strong"
      role="separator"
      {...props}
    />
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
