"use client"

import { useState, useEffect } from "react"
import confetti from "canvas-confetti"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HeartPulse, Footprints, Coffee } from "lucide-react"

interface PostFocusBreakModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionMinutes: number
}

export function PostFocusBreakModal({ open, onOpenChange, sessionMinutes }: PostFocusBreakModalProps) {
  const [breakTimer, setBreakTimer] = useState<number | null>(null)
  const [breakType, setBreakType] = useState<"breathe" | "walk" | "snack" | null>(null)
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale">("Inhale")

  useEffect(() => {
    if (open) {
      // Fire celebration confetti when focus completes!
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
      })
    }
  }, [open])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (breakTimer !== null && breakTimer > 0) {
      interval = setInterval(() => {
        setBreakTimer((prev) => (prev !== null && prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [breakTimer])

  // Breathing cycle animation text driver
  useEffect(() => {
    if (breakType !== "breathe" || breakTimer === null) return
    const cycleInterval = setInterval(() => {
      setBreathPhase((prev) => {
        if (prev === "Inhale") return "Hold"
        if (prev === "Hold") return "Exhale"
        return "Inhale"
      })
    }, 4000)
    return () => clearInterval(cycleInterval)
  }, [breakType, breakTimer])

  function startBreak(mins: number, type: "breathe" | "walk" | "snack") {
    setBreakTimer(mins * 60)
    setBreakType(type)
  }

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-surface-1 border-2 border-accent-success/50 shadow-2xl rounded-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent-success/20 via-accent-primary/20 to-accent-success/20 p-6 text-center border-b border-accent-success/30">
          <Badge className="bg-accent-success text-black font-bold uppercase tracking-wider text-xs mb-2 px-3 py-1">
            🎉 Focus Complete ({sessionMinutes} Min)
          </Badge>
          <h2 className="text-2xl font-black text-text-primary tracking-tight">
            Protect Your Brain Energy
          </h2>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
            ADHD hyperfocus is exhausting. Taking a structured 5-15 minute break prevents burnout and keeps your dopamine high for the next sprint.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {breakTimer === null ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {/* 5m Breathe */}
              <button
                onClick={() => startBreak(5, "breathe")}
                className="p-4 rounded-xl border border-border-subtle bg-surface-2 hover:border-accent-primary hover:bg-accent-primary/5 transition-all text-center space-y-2 group cursor-pointer"
              >
                <div className="p-3 rounded-full bg-accent-primary/10 text-accent-primary w-fit mx-auto group-hover:scale-110 transition-transform">
                  <HeartPulse className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-text-primary">5-Min Breathe</h4>
                <p className="text-xs text-text-disabled">Reset nervous system</p>
              </button>

              {/* 10m Walk */}
              <button
                onClick={() => startBreak(10, "walk")}
                className="p-4 rounded-xl border border-border-subtle bg-surface-2 hover:border-accent-warm hover:bg-accent-warm/5 transition-all text-center space-y-2 group cursor-pointer"
              >
                <div className="p-3 rounded-full bg-accent-warm/10 text-accent-warm w-fit mx-auto group-hover:scale-110 transition-transform">
                  <Footprints className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-text-primary">10-Min Walk</h4>
                <p className="text-xs text-text-disabled">Stretch legs & eyes</p>
              </button>

              {/* 15m Hydrate/Snack */}
              <button
                onClick={() => startBreak(15, "snack")}
                className="p-4 rounded-xl border border-border-subtle bg-surface-2 hover:border-accent-success hover:bg-accent-success/5 transition-all text-center space-y-2 group cursor-pointer"
              >
                <div className="p-3 rounded-full bg-accent-success/10 text-accent-success w-fit mx-auto group-hover:scale-110 transition-transform">
                  <Coffee className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-text-primary">15-Min Hydrate</h4>
                <p className="text-xs text-text-disabled">Water & healthy snack</p>
              </button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              {/* Breathing Circle Ring Animation */}
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-accent-success/30 animate-ping opacity-25" />
                <div className="absolute inset-2 rounded-full border-4 border-accent-primary animate-pulse" />
                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-text-primary">{formatSecs(breakTimer)}</p>
                  {breakType === "breathe" && (
                    <span className="text-xs font-semibold text-accent-primary uppercase tracking-wider block mt-1">
                      {breathPhase}…
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-text-secondary">
                {breakType === "breathe" && "Follow the ring. Deep inhales through nose, slow exhales."}
                {breakType === "walk" && "Step away from screens. Look 20 feet away."}
                {breakType === "snack" && "Drink a glass of water and grab a healthy snack."}
              </p>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBreakTimer(null)
                  onOpenChange(false)
                }}
              >
                End Break Early
              </Button>
            </div>
          )}

          {/* Gentle Skip Button */}
          {breakTimer === null && (
            <div className="flex items-center justify-between border-t border-border-subtle pt-4">
              <span className="text-xs text-text-disabled">
                Skipping breaks increases error rate by 35%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-text-secondary hover:text-text-primary"
                onClick={() => onOpenChange(false)}
              >
                Skip Break
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
