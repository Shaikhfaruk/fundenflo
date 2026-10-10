"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

import { Icon } from "./icon"
import { Spinner } from "./spinner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <Icon name="check-circle" size={20} className="text-success" />,
        info: <Icon name="info" size={20} className="text-info" />,
        warning: <Icon name="error" size={20} className="text-gold-deep" />,
        error: <Icon name="error" size={20} className="text-destructive" />,
        loading: <Spinner className="size-[18px] text-navy" />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !gap-3 !shadow-float !font-sans",
          title: "!text-sm !font-semibold !text-navy",
          description: "!text-[13px] !text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
