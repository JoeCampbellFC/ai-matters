import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/** A vertically-connected list of events -- each item's indicator dot lines up with a connector drawn down to the next item, hidden on the last item. */
function Timeline({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline"
      role="list"
      className={cn(
        "flex flex-col [&>[data-slot=timeline-item]:last-child_[data-slot=timeline-connector]]:hidden",
        className
      )}
      {...props}
    />
  )
}

function TimelineItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-item"
      role="listitem"
      className={cn("relative flex gap-4 pb-6 last:pb-0", className)}
      {...props}
    />
  )
}

const timelineIndicatorVariants = cva(
  "relative z-10 mt-1 flex size-2.5 shrink-0 rounded-full ring-4 ring-background",
  {
    variants: {
      variant: {
        default: "bg-muted-foreground/50",
        primary: "bg-primary",
        success: "bg-emerald-500",
        warning: "bg-amber-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TimelineIndicator({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof timelineIndicatorVariants>) {
  return (
    <span
      data-slot="timeline-indicator"
      className={cn(timelineIndicatorVariants({ variant }), className)}
      {...props}
    />
  )
}

/** The line connecting this item's indicator down to the next one -- positioned behind the indicator column, never rendered past the last item (see Timeline's last-child rule). */
function TimelineConnector({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="timeline-connector"
      aria-hidden="true"
      className={cn("absolute top-4 bottom-0 left-[4.5px] w-px bg-border", className)}
      {...props}
    />
  )
}

function TimelineContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
      {...props}
    />
  )
}

function TimelineTime({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="timeline-time"
      className={cn("text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

function TimelineTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="timeline-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function TimelineDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="timeline-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Timeline,
  TimelineItem,
  TimelineIndicator,
  TimelineConnector,
  TimelineContent,
  TimelineTime,
  TimelineTitle,
  TimelineDescription,
}
