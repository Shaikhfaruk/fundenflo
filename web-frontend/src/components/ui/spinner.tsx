import { cn } from "cn"

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
      {...props}
    />
  )
}

export { Spinner }
