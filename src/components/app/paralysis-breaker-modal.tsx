"use client"

import { useMemo, useState, useEffect } from "react"
import confetti from "canvas-confetti"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles, Zap } from "lucide-react"
import { type TaskRow } from "@/hooks/use-tasks"
import { createClient } from "@/lib/supabase/client"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ParalysisBreakerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: TaskRow[]
}

export function ParalysisBreakerModal({ open, onOpenChange, tasks }: ParalysisBreakerModalProps) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [completedCount, setCompletedCount] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(120) // 2-min micro sprint
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  // Filter tasks to find open ones and pick the single lowest dread / easiest task
  const easiestTask = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status !== "done")
    if (openTasks.length === 0) return null

    // Sort by dread_level ascending (1-5), then effort (low -> medium -> high), then title length
    return [...openTasks].sort((a, b) => {
      const dreadA = a.dread_level ?? 1
      const dreadB = b.dread_level ?? 1
      if (dreadA !== dreadB) return dreadA - dreadB

      const effortWeight = (e: string | null) => (e === "low" ? 1 : e === "medium" ? 2 : 3)
      const effortDiff = effortWeight(a.effort) - effortWeight(b.effort)
      if (effortDiff !== 0) return effortDiff

      return a.title.length - b.title.length
    })[0]
  }, [tasks])

  useEffect(() => {
    if (!isTimerRunning) return
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isTimerRunning])

  async function handleCompleteTask() {
    if (!easiestTask) return
    setCompleting(true)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: now })
        .eq("id", easiestTask.id)

      if (error) throw error

      // Fire confetti burst!
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#10b981", "#f59e0b", "#ec4899"],
      })

      setCompletedCount((prev) => prev + 1)
      toast.success("💥 Task smashed! Great job breaking the paralysis.")
      await qc.invalidateQueries({ queryKey: ["tasks"] })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCompleting(false)
      setIsTimerRunning(false)
      setTimerSeconds(120)
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card border-2 border-warning/50 shadow-2xl rounded-xl">
        {/* Glowing Top Banner */}
        <div className="bg-gradient-to-r from-warning/20 via-primary/20 to-warning/20 p-6 text-center border-b border-warning/30 relative">
          <Badge className="bg-warning text-black font-bold uppercase tracking-wider text-xs mb-2 px-3 py-1 animate-pulse">
            🧊 ADHD Paralysis Breaker
          </Badge>
          <h2 className="text-2xl font-black text-foreground tracking-tight">
            Put Blinders On. Just This One.
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Forget your 20 other tasks. We selected the absolute easiest, lowest-dread task on your list to get your dopamine engine started.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {easiestTask ? (
            <div className="relative group">
              {/* Outer pulsing ring */}
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-warning via-primary to-success opacity-30 group-hover:opacity-60 blur-md transition duration-500 animate-pulse" />

              <div className="relative p-6 rounded-xl bg-secondary border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-success/50 text-success bg-success/10 text-xs">
                      🟢 Easiest Win (Dread {easiestTask.dread_level ?? 1}/5)
                    </Badge>
                    {easiestTask.effort && (
                      <Badge variant="outline" className="border-border text-muted-foreground text-xs capitalize">
                        Effort: {easiestTask.effort}
                      </Badge>
                    )}
                  </div>
                  {completedCount > 0 && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary font-semibold text-xs">
                      🔥 {completedCount} Smashed Today
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-foreground leading-snug">
                    {easiestTask.title}
                  </h3>
                  {easiestTask.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3 bg-card/50 p-3 rounded-lg border border-border/50">
                      {easiestTask.description}
                    </p>
                  )}
                </div>

                {/* Micro 2-min Sprint Timer */}
                <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border">
                  <div className="flex items-center gap-2">
                    <Zap className={cn("h-4 w-4", isTimerRunning ? "text-warning animate-bounce" : "text-disabled")} />
                    <span className="text-xs font-medium text-muted-foreground">
                      2-Minute Micro-Sprint:
                    </span>
                    <span className="text-sm font-mono font-bold text-foreground">
                      {formatTime(timerSeconds)}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant={isTimerRunning ? "outline" : "secondary"}
                    className="text-xs h-8"
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                  >
                    {isTimerRunning ? "Pause" : "Start 2m Timer"}
                  </Button>
                </div>

                {/* Complete Action */}
                <Button
                  size="lg"
                  disabled={completing}
                  onClick={handleCompleteTask}
                  className="w-full h-14 text-base font-bold bg-gradient-to-r from-warning via-primary to-success text-primary-foreground shadow-lg hover:opacity-90 transition-all rounded-xl gap-2 cursor-pointer"
                >
                  <Check className="h-5 w-5 stroke-[3]" />
                  Mark Complete & Smash Paralysis!
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <div className="inline-flex p-4 rounded-full bg-success/10 text-success">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No Open Tasks Left!</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                You&apos;ve cleared all open tasks or your backlog is completely empty. Take a breath!
              </p>
              <Button onClick={() => onOpenChange(false)} variant="outline">
                Close Breaker
              </Button>
            </div>
          )}

          {/* Micro Motivational Footer */}
          <div className="text-center border-t border-border pt-4">
            <p className="text-xs text-disabled italic">
              &quot;Action creates motivation, not the other way around. Finishing 1 micro-step breaks the freeze state.&quot;
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
