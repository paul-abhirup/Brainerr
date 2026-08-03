"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTasks } from "@/hooks/use-tasks"
import { useHabits } from "@/hooks/use-data"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
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
      <PageHeader
        eyebrow={`Level ${level} Brain Master`}
        title="Achievement Gallery"
        description="Unlock trophies by smashing tasks, protecting streaks, and staying in flow state."
        actions={
          <Card className="w-full sm:w-64 p-4 space-y-2 shadow-md">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">Level {level}</span>
              <span className="text-primary">{levelXP} / 300 XP</span>
            </div>
            <div className="h-3 w-full rounded-full bg-secondary overflow-hidden border border-border/50 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-500"
                style={{ width: `${levelPct}%` }}
              />
            </div>
            <p className="text-xs text-disabled">
              {300 - levelXP} XP to Level {level + 1}
            </p>
          </Card>
        }
      />

      {/* Stats KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center border-border">
          <Trophy className="h-6 w-6 text-warning mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{unlockedCount} / {achievementDefs.length}</p>
          <span className="text-xs text-disabled uppercase font-medium">Unlocked</span>
        </Card>

        <Card className="p-4 text-center border-border">
          <Zap className="h-6 w-6 text-primary mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{totalXP}</p>
          <span className="text-xs text-disabled uppercase font-medium">Total XP Points</span>
        </Card>

        <Card className="p-4 text-center border-border">
          <Flame className="h-6 w-6 text-warning mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{maxStreak} Days</p>
          <span className="text-xs text-disabled uppercase font-medium">Best Streak</span>
        </Card>

        <Card className="p-4 text-center border-border">
          <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{completedTasksCount}</p>
          <span className="text-xs text-disabled uppercase font-medium">Tasks Smashed</span>
        </Card>
      </div>

      {/* Achievement Cards Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
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
                    ? "border-primary/40 bg-card hover:border-primary hover:shadow-md"
                    : "bg-secondary/40 border-border/50 opacity-60 grayscale",
                )}
              >
                {a.unlocked && (
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all" />
                )}

                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "p-3 rounded-2xl shrink-0 transition-transform group-hover:scale-110",
                      a.unlocked
                        ? "bg-gradient-to-br from-primary/20 to-warning/20 text-primary border border-primary/30"
                        : "bg-muted text-disabled",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground truncate">{a.title}</h4>
                      {a.unlocked ? (
                        <Badge variant="success" className="text-xs font-bold">
                          +{a.xp} XP
                        </Badge>
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-disabled" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{a.description}</p>

                    {/* Progress Bar for Locked */}
                    {!a.unlocked && a.maxProgress > 1 && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs text-disabled mb-1">
                          <span>Progress</span>
                          <span>{a.progress} / {a.maxProgress}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary"
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
