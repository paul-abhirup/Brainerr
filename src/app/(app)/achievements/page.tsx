"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTasks } from "@/hooks/use-tasks"
import { useHabits } from "@/hooks/use-data"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Flame, Zap, Lock, CheckCircle2, Award, Star, ShieldCheck, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AchievementDef {
  id: string
  title: string
  description: string
  icon: typeof Trophy
  category: "streak" | "focus" | "tasks" | "adhd"
  xp: number
  unlocked: boolean
  progress: number
  maxProgress: number
}

export default function AchievementsPage() {
  const supabase = createClient()
  const { data: tasks } = useTasks()
  const { data: habits } = useHabits()

  // Fetch earned achievements from DB
  const { data: earnedAchievements } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return []
      const { data, error } = await supabase.from("achievements").select("*").eq("user_id", user.id)
      if (error) throw error
      return data ?? []
    },
  })

  // Calculate metrics
  const completedTasksCount = useMemo(
    () => (tasks ?? []).filter((t) => t.status === "done").length,
    [tasks],
  )

  const maxStreak = useMemo(
    () => Math.max(0, ...(habits ?? []).map((h) => h.best_streak ?? 0)),
    [habits],
  )

  const totalXP = useMemo(() => {
    const taskXP = completedTasksCount * 15
    const streakXP = maxStreak * 25
    const achievementXP = (earnedAchievements ?? []).reduce((acc, a) => acc + (a.points ?? 50), 0)
    return taskXP + streakXP + achievementXP
  }, [completedTasksCount, maxStreak, earnedAchievements])

  const level = Math.floor(totalXP / 300) + 1
  const levelXP = totalXP % 300
  const levelPct = Math.min(100, Math.round((levelXP / 300) * 100))

  // Definitions list
  const achievementDefs: AchievementDef[] = useMemo(() => {
    const earnedTypes = new Set((earnedAchievements ?? []).map((a) => a.type))

    return [
      {
        id: "first_task",
        title: "First Step Smashed",
        description: "Complete your very first task in Brainer.",
        icon: CheckCircle2,
        category: "tasks",
        xp: 50,
        unlocked: completedTasksCount >= 1 || earnedTypes.has("first_task"),
        progress: Math.min(1, completedTasksCount),
        maxProgress: 1,
      },
      {
        id: "task_10",
        title: "Dopamine Generator",
        description: "Complete 10 total tasks.",
        icon: Zap,
        category: "tasks",
        xp: 100,
        unlocked: completedTasksCount >= 10 || earnedTypes.has("task_10"),
        progress: Math.min(10, completedTasksCount),
        maxProgress: 10,
      },
      {
        id: "task_50",
        title: "Task Crusher",
        description: "Complete 50 total tasks.",
        icon: Trophy,
        category: "tasks",
        xp: 250,
        unlocked: completedTasksCount >= 50 || earnedTypes.has("task_50"),
        progress: Math.min(50, completedTasksCount),
        maxProgress: 50,
      },
      {
        id: "streak_3",
        title: "Consistency Ignition",
        description: "Maintain a 3-day habit streak.",
        icon: Flame,
        category: "streak",
        xp: 75,
        unlocked: maxStreak >= 3 || earnedTypes.has("streak_3"),
        progress: Math.min(3, maxStreak),
        maxProgress: 3,
      },
      {
        id: "streak_7",
        title: "Unstoppable Momentum",
        description: "Reach a 7-day habit streak.",
        icon: Star,
        category: "streak",
        xp: 150,
        unlocked: maxStreak >= 7 || earnedTypes.has("streak_7"),
        progress: Math.min(7, maxStreak),
        maxProgress: 7,
      },
      {
        id: "paralysis_breaker",
        title: "Paralysis Breaker",
        description: "Use ADHD Paralysis Breaker mode to complete a task.",
        icon: ShieldCheck,
        category: "adhd",
        xp: 100,
        unlocked: earnedTypes.has("paralysis_breaker") || completedTasksCount >= 3,
        progress: Math.min(1, completedTasksCount >= 3 ? 1 : 0),
        maxProgress: 1,
      },
      {
        id: "focus_marathon",
        title: "Deep Flow Master",
        description: "Complete a 45+ minute focus timer session.",
        icon: Award,
        category: "focus",
        xp: 120,
        unlocked: earnedTypes.has("focus_marathon"),
        progress: earnedTypes.has("focus_marathon") ? 1 : 0,
        maxProgress: 1,
      },
      {
        id: "inbox_zero",
        title: "Mental Clarity (Inbox Zero)",
        description: "Process all items in your raw Inbox.",
        icon: Sparkles,
        category: "tasks",
        xp: 100,
        unlocked: earnedTypes.has("inbox_zero"),
        progress: earnedTypes.has("inbox_zero") ? 1 : 0,
        maxProgress: 1,
      },
    ]
  }, [completedTasksCount, maxStreak, earnedAchievements])

  const unlockedCount = achievementDefs.filter((a) => a.unlocked).length

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Level Header Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-accent-primary/20 via-accent-warm/20 to-accent-success/20 p-6 border-2 border-accent-primary/30 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-accent-primary text-white font-bold uppercase text-xs px-3 py-1">
                Level {level} Brain Master
              </Badge>
            </div>
            <h1 className="text-3xl font-black text-text-primary tracking-tight sm:text-4xl">
              Achievement Gallery
            </h1>
            <p className="text-xs text-text-secondary max-w-md">
              Unlock trophies by smashing tasks, protecting streaks, and staying in flow state.
            </p>
          </div>

          {/* Level Progress Circular / Bar Gauge */}
          <div className="w-full bg-surface-1/90 backdrop-blur-md p-5 rounded-xl border border-border-subtle md:w-64 space-y-2 text-center">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-text-secondary">Level {level}</span>
              <span className="text-accent-primary">{levelXP} / 300 XP</span>
            </div>
            <div className="h-3.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border-subtle/50 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-success transition-all duration-500"
                style={{ width: `${levelPct}%` }}
              />
            </div>
            <p className="text-xs text-text-disabled">
              {300 - levelXP} XP to Level {level + 1}
            </p>
          </div>
        </div>
      </div>

      {/* Stats KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-card p-4 text-center border-border-subtle">
          <Trophy className="h-6 w-6 text-accent-warm mx-auto mb-1" />
          <p className="text-2xl font-black text-text-primary">{unlockedCount} / {achievementDefs.length}</p>
          <span className="text-xs text-text-disabled uppercase font-medium">Unlocked</span>
        </Card>

        <Card className="glass-card p-4 text-center border-border-subtle">
          <Zap className="h-6 w-6 text-accent-primary mx-auto mb-1" />
          <p className="text-2xl font-black text-text-primary">{totalXP}</p>
          <span className="text-xs text-text-disabled uppercase font-medium">Total XP Points</span>
        </Card>

        <Card className="glass-card p-4 text-center border-border-subtle">
          <Flame className="h-6 w-6 text-accent-warm mx-auto mb-1" />
          <p className="text-2xl font-black text-text-primary">{maxStreak} Days</p>
          <span className="text-xs text-text-disabled uppercase font-medium">Best Streak</span>
        </Card>

        <Card className="glass-card p-4 text-center border-border-subtle">
          <CheckCircle2 className="h-6 w-6 text-accent-success mx-auto mb-1" />
          <p className="text-2xl font-black text-text-primary">{completedTasksCount}</p>
          <span className="text-xs text-text-disabled uppercase font-medium">Tasks Smashed</span>
        </Card>
      </div>

      {/* Achievement Cards Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Award className="h-5 w-5 text-accent-primary" />
          All Trophies ({achievementDefs.length})
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {achievementDefs.map((a) => {
            const Icon = a.icon
            return (
              <Card
                key={a.id}
                className={cn(
                  "border transition-all duration-300 relative overflow-hidden group",
                  a.unlocked
                    ? "glass-card border-accent-primary/40 bg-surface-1 hover:border-accent-primary hover:shadow-xl"
                    : "bg-surface-2/40 border-border-subtle/50 opacity-60 grayscale",
                )}
              >
                {a.unlocked && (
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-accent-primary/10 rounded-full blur-xl group-hover:bg-accent-primary/20 transition-all" />
                )}

                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "p-3 rounded-2xl shrink-0 transition-transform group-hover:scale-110",
                      a.unlocked
                        ? "bg-gradient-to-br from-accent-primary/20 to-accent-warm/20 text-accent-primary border border-accent-primary/30"
                        : "bg-surface-3 text-text-disabled",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-text-primary truncate">{a.title}</h4>
                      {a.unlocked ? (
                        <Badge className="bg-accent-success/20 text-accent-success text-xs font-bold">
                          +{a.xp} XP
                        </Badge>
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-text-disabled" />
                      )}
                    </div>
                    <p className="text-xs text-text-secondary leading-snug">{a.description}</p>

                    {/* Progress Bar for Locked */}
                    {!a.unlocked && a.maxProgress > 1 && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs text-text-disabled mb-1">
                          <span>Progress</span>
                          <span>{a.progress} / {a.maxProgress}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className="h-full bg-accent-primary"
                            style={{ width: `${(a.progress / a.maxProgress) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
