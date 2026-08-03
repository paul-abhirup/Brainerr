import { cn } from "@/lib/utils"

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center",
        className
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center">{icon}</span>
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-disabled">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
