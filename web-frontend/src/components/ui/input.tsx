import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

import { FIELD_SURFACE } from "./field-surface"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-[54px] w-full min-w-0 px-4 text-base font-medium file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        FIELD_SURFACE,
        className
      )}
      {...props}
    />
  )
}

export { Input }
