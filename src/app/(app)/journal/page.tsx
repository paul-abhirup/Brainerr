"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTasks } from "@/hooks/use-tasks"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { Input } from "@/components/ui/input"
import { BookOpen, CheckCircle2, Calendar as CalendarIcon, HeartPulse, Save } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts"

export default function JournalPage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: tasks } = useTasks()

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [journalText, setJournalText] = useState("")
  const [energyLevel, setEnergyLevel] = useState<"low" | "medium" | "high">("medium")
  const [saving, setSaving] = useState(false)

  // Fetch completed tasks for selected date
  const dayStart = useMemo(() => new Date(selectedDate).setHours(0, 0, 0, 0), [selectedDate])
  const dayEnd = useMemo(() => new Date(selectedDate).setHours(23, 59, 59, 999), [selectedDate])

  const completedToday = useMemo(() => {
    return (tasks ?? []).filter((t) => {
      if (t.status !== "done" || !t.completed_at) return false
      const tTime = new Date(t.completed_at).getTime()
      return tTime >= dayStart && tTime <= dayEnd
    })
  }, [tasks, dayStart, dayEnd])

  // Fetch or create note entry tagged with 'journal'
  const { data: journalNote } = useQuery({
    queryKey: ["journal_entry", selectedDate],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return null
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .contains("tags", ["journal"])
        .like("title", `%${selectedDate}%`)
        .single()

      if (error && error.code !== "PGRST116") return null
      if (data) {
        setJournalText(data.body ?? "")
      }
      return data ?? null
    },
  })

  async function handleSaveJournal() {
    setSaving(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error("Not authenticated")

      const title = `Journal Entry — ${selectedDate}`
      if (journalNote) {
        await supabase
          .from("notes")
          .update({ body: journalText, updated_at: new Date().toISOString() })
          .eq("id", journalNote.id)
      } else {
        await supabase.from("notes").insert({
          user_id: user.id,
          title,
          body: journalText,
          tags: ["journal", selectedDate],
        })
      }

      // Also update energy in user_state
      await supabase.from("user_state").upsert(
        { user_id: user.id, mood_energy: energyLevel, last_mood_checkin: new Date().toISOString() },
        { onConflict: "user_id" },
      )

      await qc.invalidateQueries({ queryKey: ["journal_entry", selectedDate] })
      await qc.invalidateQueries({ queryKey: ["user_state"] })
      toast.success("📓 Reflection saved cleanly!")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Mock mood history trend data
  const moodTrendData = [
    { day: "Mon", energy: 2 },
    { day: "Tue", energy: 3 },
    { day: "Wed", energy: 1 },
    { day: "Thu", energy: 2 },
    { day: "Fri", energy: 3 },
    { day: "Sat", energy: 2 },
    { day: "Today", energy: energyLevel === "high" ? 3 : energyLevel === "medium" ? 2 : 1 },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Daily Reflection"
        title="Daily Brain Journal"
        description="Reflect on wins, log your mood, and clear mental static before bed."
        actions={
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-disabled" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto bg-card text-foreground"
            />
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Energy Check-in & Auto-populated Wins */}
        <div className="space-y-6 md:col-span-1">
          {/* Energy Check-in */}
          <Card className="border-border shadow-md p-5 space-y-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-warning" />
              Daily Energy Level
            </CardTitle>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(["low", "medium", "high"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setEnergyLevel(level)}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    energyLevel === level
                      ? "border-warning bg-warning/15 text-warning shadow-md scale-105"
                      : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  {level === "low" ? "⚡ Low" : level === "medium" ? "⚡ Med" : "⚡ High"}
                </button>
              ))}
            </div>
          </Card>

          {/* Auto-populated Wins */}
          <Card className="border-success/30 bg-success/5 shadow-md p-5 space-y-3">
            <CardTitle className="text-sm font-bold text-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Today&apos;s Smashed Wins ({completedToday.length})
            </CardTitle>
            <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
              {completedToday.length === 0 ? (
                <p className="text-xs text-disabled py-2">No completed tasks recorded for this date yet.</p>
              ) : (
                completedToday.map((t) => (
                  <div key={t.id} className="text-xs font-medium text-foreground flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Mood Trend Chart */}
          <Card className="border-border shadow-md p-4 space-y-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              7-Day Energy Trend
            </CardTitle>
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={moodTrendData}>
                  <defs>
                    <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip />
                  <Area type="monotone" dataKey="energy" stroke="var(--warning)" fillOpacity={1} fill="url(#energyGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Right Column: Markdown Journal Reflection Textarea */}
        <div className="space-y-6 md:col-span-2">
          <Card className="border-border shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Reflections & Brain Dump
              </CardTitle>
              <Button
                onClick={handleSaveJournal}
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-1.5 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save Entry"}
              </Button>
            </div>

            {/* Quick Prompts Helper */}
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <button
                onClick={() => setJournalText((prev) => prev + "\n\n### 🌟 Big Win Today:\n- ")}
                className="p-2 rounded-lg border border-border bg-secondary hover:border-primary transition-all text-left text-muted-foreground cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                + Insert &quot;Big Win&quot;
              </button>
              <button
                onClick={() => setJournalText((prev) => prev + "\n\n### 🚧 Friction & Blockers:\n- ")}
                className="p-2 rounded-lg border border-border bg-secondary hover:border-warning transition-all text-left text-muted-foreground cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                + Insert &quot;Blockers&quot;
              </button>
              <button
                onClick={() => setJournalText((prev) => prev + "\n\n### 🎯 Victory for Tomorrow:\n- ")}
                className="p-2 rounded-lg border border-border bg-secondary hover:border-success transition-all text-left text-muted-foreground cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                + Insert &quot;Tomorrow Goal&quot;
              </button>
            </div>

            <Textarea
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="What went well today? What caused friction or overwhelm? What's one thing you want to smash tomorrow?"
              className="min-h-[320px] font-sans text-sm leading-relaxed p-4 rounded-xl bg-secondary/60 border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
