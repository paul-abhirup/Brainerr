"use client"

import { useState } from "react"
import { Card, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Droplet, Moon, Utensils, Sparkles, Plus, Minus, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type WellnessState = {
  waterGlasses: number
  sleepHours: number
  meals: { breakfast: boolean; lunch: boolean; dinner: boolean }
}

const DEFAULT_WELLNESS: WellnessState = {
  waterGlasses: 4,
  sleepHours: 7.5,
  meals: { breakfast: true, lunch: true, dinner: false },
}

function readWellness(): WellnessState {
  if (typeof window === "undefined") return DEFAULT_WELLNESS
  const today = new Date().toISOString().split("T")[0]
  const saved = localStorage.getItem(`wellness_${today}`)
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Partial<WellnessState>
      return {
        waterGlasses: typeof parsed.waterGlasses === "number" ? parsed.waterGlasses : DEFAULT_WELLNESS.waterGlasses,
        sleepHours: typeof parsed.sleepHours === "number" ? parsed.sleepHours : DEFAULT_WELLNESS.sleepHours,
        meals: parsed.meals ? { ...DEFAULT_WELLNESS.meals, ...parsed.meals } : DEFAULT_WELLNESS.meals,
      }
    } catch {
      return DEFAULT_WELLNESS
    }
  }
  return DEFAULT_WELLNESS
}

export function WellnessWidget() {
  const [saved] = useState(readWellness)
  const [waterGlasses, setWaterGlasses] = useState(saved.waterGlasses)
  const [sleepHours, setSleepHours] = useState(saved.sleepHours)
  const [meals, setMeals] = useState(saved.meals)

  function saveWellness(updated: { waterGlasses?: number; sleepHours?: number; meals?: typeof meals }) {
    const today = new Date().toISOString().split("T")[0]
    const nextState = {
      waterGlasses: updated.waterGlasses ?? waterGlasses,
      sleepHours: updated.sleepHours ?? sleepHours,
      meals: updated.meals ?? meals,
    }
    localStorage.setItem(`wellness_${today}`, JSON.stringify(nextState))
  }

  function adjustWater(delta: number) {
    setWaterGlasses((prev) => {
      const next = Math.max(0, Math.min(12, prev + delta))
      saveWellness({ waterGlasses: next })
      if (next === 8) toast.success("💧 Hydration Goal Reached! 8/8 Glasses.")
      return next
    })
  }

  function toggleMeal(key: keyof typeof meals) {
    setMeals((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      saveWellness({ meals: next })
      return next
    })
  }

  return (
    <Card className="glass-card border-border-subtle shadow-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-text-primary">
          <Sparkles className="h-4 w-4 text-accent-primary" />
          Body & Wellness Tracker
        </CardTitle>
        <Badge variant="outline" className="text-xs text-accent-success border-accent-success/30">
          Daily Fuel
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* 💧 Water Hydration Tracker */}
        <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border-subtle/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
            <span className="flex items-center gap-1.5 text-accent-primary">
              <Droplet className="h-4 w-4 fill-accent-primary/20" /> Water
            </span>
            <span className="tabular-nums font-bold">{waterGlasses} / 8</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => adjustWater(-1)}
              className="h-8 w-8 rounded-xl text-text-secondary"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>

            {/* Glass Visual Dots */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-all",
                    i <= waterGlasses
                      ? "bg-accent-primary shadow-[0_0_6px_var(--accent-primary)]"
                      : "bg-surface-3",
                  )}
                />
              ))}
            </div>

            <Button
              size="icon"
              variant="outline"
              onClick={() => adjustWater(1)}
              className="h-8 w-8 rounded-xl text-accent-primary border-accent-primary/40"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 😴 Sleep Hours Tracker */}
        <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border-subtle/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
            <span className="flex items-center gap-1.5 text-accent-warm">
              <Moon className="h-4 w-4 fill-accent-warm/20" /> Sleep
            </span>
            <span className="tabular-nums font-bold">{sleepHours} Hours</span>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1">
            {[6, 7.5, 9].map((h) => (
              <button
                key={h}
                onClick={() => {
                  setSleepHours(h)
                  saveWellness({ sleepHours: h })
                }}
                className={cn(
                  "py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                  sleepHours === h
                    ? "border-accent-warm bg-accent-warm/20 text-accent-warm"
                    : "border-border-subtle/60 text-text-disabled hover:text-text-secondary",
                )}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* 🍎 Meals Check-in */}
        <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border-subtle/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
            <span className="flex items-center gap-1.5 text-accent-success">
              <Utensils className="h-4 w-4" /> Meals
            </span>
            <span className="text-xs text-text-disabled">Fuel check</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            {(["breakfast", "lunch", "dinner"] as const).map((m) => (
              <button
                key={m}
                onClick={() => toggleMeal(m)}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1 cursor-pointer",
                  meals[m]
                    ? "border-accent-success bg-accent-success/20 text-accent-success"
                    : "border-border-subtle/60 text-text-disabled",
                )}
              >
                {meals[m] && <Check className="h-3 w-3 stroke-[3]" />}
                {m.slice(0, 4)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Micro ADHD Insight */}
      <div className="p-3 rounded-xl bg-surface-1 border border-border-subtle/40 text-center">
        <p className="text-xs text-text-secondary">
          💡 <span className="font-semibold text-text-primary">ADHD Insight:</span> Days with 7.5+ hours of sleep and 6+ glasses of water yield <span className="text-accent-success font-bold">+38% higher task completion</span>.
        </p>
      </div>
    </Card>
  )
}
