import * as React from "react"
import { cn } from "cn"

import { FIELD_SURFACE } from "./field-surface"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full px-4 py-3 text-base",
        FIELD_SURFACE,
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
