"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { cn } from "cn"

import { FIELD_SURFACE } from "./field-surface"
import { Icon } from "./icon"

const Combobox = ComboboxPrimitive.Root

function ComboboxInput({
  className,
  size = "default",
  ...props
}: Omit<ComboboxPrimitive.Input.Props, "size"> & { size?: "sm" | "default" }) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      data-size={size}
      className={cn(
        "flex w-full items-center gap-2 pr-3 data-[size=default]:h-[54px] data-[size=sm]:h-11",
        FIELD_SURFACE,
        className
      )}
    >
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className="h-full min-w-0 flex-1 bg-transparent pl-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
        {...props}
      />
      <span className="pointer-events-none flex text-muted-foreground" aria-hidden="true">
        <Icon name="expand-more" size={20} />
      </span>
    </ComboboxPrimitive.InputGroup>
  )
}

function ComboboxContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "sideOffset">) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner sideOffset={sideOffset} className="isolate z-50">
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "flex max-h-[min(var(--available-height),20rem)] w-(--anchor-width) origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-card duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn("flex min-h-0 flex-col gap-0.5 overflow-y-auto outline-none", className)}
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 flex-col">{children}</span>
      <ComboboxPrimitive.ItemIndicator
        render={<span className="ml-auto flex size-4 shrink-0 items-center justify-center" />}
      >
        <Icon name="check" size={18} className="text-navy" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("px-2 py-3 text-center text-sm text-muted-foreground empty:p-0", className)}
      {...props}
    />
  )
}

function ComboboxStatus({ className, ...props }: ComboboxPrimitive.Status.Props) {
  return (
    <ComboboxPrimitive.Status
      data-slot="combobox-status"
      className={cn("flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground empty:p-0", className)}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
}
