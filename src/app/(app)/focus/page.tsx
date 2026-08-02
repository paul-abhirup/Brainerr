"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTasks } from "@/hooks/use-tasks"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Play, Pause, RotateCcw, Check, Music, Volume2, VolumeX, Flame, Sparkles, Keyboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { PostFocusBreakModal } from "@/components/app/post-focus-break-modal"

type SoundPreset = "none" | "white" | "binaural" | "lo-fi"

const DURATIONS = [15, 25, 45, 60]

export default function FocusPage() {
  const { data: tasks } = useTasks()
  const qc = useQueryClient()
  const supabase = createClient()

  const [duration, setDuration] = useState(25)
  const [remaining, setRemaining] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [taskId, setTaskId] = useState<string>("")
  const [sound, setSound] = useState<SoundPreset>("none")
  const [elapsed, setElapsed] = useState(0)
  const [breakModalOpen, setBreakModalOpen] = useState(false)


  const audioCtxRef = useRef<AudioContext | null>(null)
  const noiseNodes = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null)
  const oscNodes = useRef<OscillatorNode[]>([])

  useEffect(() => {
    if (!running) return
    const startedAt = Date.now()
    const startRemaining = remaining
    const interval = setInterval(() => {
      const next = startRemaining - Math.floor((Date.now() - startedAt) / 1000)
      setRemaining(Math.max(0, next))
      setElapsed(duration * 60 - next)
      if (next <= 0) {
        setRunning(false)
        finishSession(duration * 60)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (running) setTaskInProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  useEffect(() => {
    return () => {
      stopAudio()
    }
  }, [])

  // Keyboard shortcut listener (Space = start/pause, R = reset)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.code === "Space") {
      e.preventDefault()
      setRunning((prev) => {
        if (prev) {
          stopAudio()
          return false
        } else {
          if (sound !== "none") startAudio()
          autoBlockCalendar()
          return true
        }
      })
    } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      reset()
    }
  }, [sound]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  async function setTaskInProgress() {
    if (!taskId) return
    await supabase.from("tasks").update({ status: "in_progress" }).eq("id", taskId)
    await supabase.from("user_state").upsert(
      { user_id: (await supabase.auth.getUser()).data.user!.id, last_active_task_id: taskId, last_opened_at: new Date().toISOString() },
    ).eq("user_id", (await supabase.auth.getUser()).data.user!.id)
  }

  async function finishSession(totalSeconds: number) {
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return
    await supabase.from("focus_sessions").insert({
      user_id: user.id,
      task_id: taskId || null,
      duration_minutes: Math.round(totalSeconds / 60),
      completed: true,
      completed_at: new Date().toISOString(),
    })
    if (taskId) {
      const { data: task } = await supabase.from("tasks").select("actual_minutes").eq("id", taskId).single()
      await supabase
        .from("tasks")
        .update({ actual_minutes: (task?.actual_minutes ?? 0) + Math.round(totalSeconds / 60), status: "todo" })
        .eq("id", taskId)
    }
    await qc.invalidateQueries({ queryKey: ["tasks"] })
    toast.success("Session complete! Great work maintaining focus.")
    setBreakModalOpen(true)
  }

  function reset() {
    setRunning(false)
    setRemaining(duration * 60)
    setElapsed(0)
    stopAudio()
  }

  function start() {
    setRunning(true)
    if (sound !== "none") startAudio()
    autoBlockCalendar()
  }

  async function autoBlockCalendar() {
    const task = taskId ? tasks?.find((t) => t.id === taskId) : undefined
    const now = new Date()
    const end = new Date(now.getTime() + duration * 60_000)
    try {
      await fetch("/api/calendar/focus-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: task?.title ?? "", start: now.toISOString(), end: end.toISOString() }),
      })
    } catch {
      // calendar not connected — focus still works
    }
  }

  function pause() {
    setRunning(false)
    stopAudio()
  }

  // ---- Ambient audio via Web Audio API ----
  function startAudio() {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    if (sound === "white" || sound === "lo-fi") {
      const bufferSize = 2 * ctx.sampleRate
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      const gain = ctx.createGain()
      gain.gain.value = sound === "white" ? 0.06 : 0.1
      let node: AudioNode = source
      if (sound === "lo-fi") {
        const filter = ctx.createBiquadFilter()
        filter.type = "lowpass"
        filter.frequency.value = 400
        node = filter
        source.connect(filter)
      }
      node.connect(gain)
      gain.connect(ctx.destination)
      source.start()
      noiseNodes.current = { source, gain }
    } else if (sound === "binaural") {
      const freqs = [220, 226]
      oscNodes.current = freqs.map((f) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = f
        gain.gain.value = 0.05
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        return osc
      })
    }
  }

  function stopAudio() {
    noiseNodes.current?.source.stop()
    noiseNodes.current = null
    oscNodes.current.forEach((o) => o.stop())
    oscNodes.current = []
    audioCtxRef.current?.close()
    audioCtxRef.current = null
  }

  function changeSound(next: SoundPreset) {
    setSound(next)
    if (running) {
      stopAudio()
      if (next !== "none") {
        setTimeout(() => startAudio(), 50)
      }
    }
  }

  const progress = 1 - remaining / (duration * 60)
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const R = 130
  const CIRC = 2 * Math.PI * R

  return (
    <div className="flex flex-col items-center space-y-8 py-4 animate-in fade-in duration-300">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/20 bg-accent-primary/10 px-3 py-1 text-xs font-medium text-accent-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Single-Task Focus State
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Focus Zone</h1>
        <p className="max-w-md text-sm text-text-secondary">
          Eliminate distraction. One block, total flow.
        </p>
      </div>

      {/* Task selector */}
      <div className="w-full max-w-md">
        <Select value={taskId || "none"} onValueChange={(v) => setTaskId(v === "none" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-full h-11 rounded-xl border-border-subtle bg-surface-1/80 backdrop-blur-md">
            <SelectValue placeholder="What are you focusing on? (optional)" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="none">No specific task (General focus)</SelectItem>
            {(tasks ?? []).filter((t) => t.status !== "done").map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Animated Timer ring */}
      <div className="relative flex h-[300px] w-[300px] sm:h-[340px] sm:w-[340px] items-center justify-center">
        <div className={cn(
          "absolute inset-0 rounded-full transition-all duration-700 blur-3xl opacity-20 pointer-events-none",
          running ? "bg-accent-primary opacity-30" : "bg-surface-3"
        )} />
        <svg viewBox="0 0 320 320" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-primary)" />
              <stop offset="100%" stopColor="var(--accent-warm)" />
            </linearGradient>
          </defs>
          <circle cx="160" cy="160" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
          <circle
            cx="160"
            cy="160"
            r={R}
            fill="none"
            stroke="url(#focusGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * progress}
            className="transition-[stroke-dashoffset] duration-500 ease-linear drop-shadow-[0_0_10px_rgba(124,158,255,0.4)]"
          />
        </svg>
        <div className={cn("absolute text-center transition-transform", running && "animate-breathe")}>
          <div className="font-mono text-5xl sm:text-6xl font-bold tabular-nums tracking-tight bg-gradient-to-b from-text-primary to-text-secondary bg-clip-text text-transparent">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          {running ? (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-accent-warm/15 px-3 py-1 text-xs font-semibold text-accent-warm animate-pulse">
              <Flame className="h-4 w-4" />
              In Deep Flow
            </div>
          ) : (
            <p className="mt-2 text-xs font-medium text-text-secondary">{duration} min block · Ready</p>
          )}
        </div>
      </div>

      {/* Duration picker */}
      <div className="flex items-center gap-1.5 rounded-full border border-border-subtle/80 bg-surface-1/90 p-1.5 backdrop-blur-md shadow-sm">
        {DURATIONS.map((d) => (
          <button
            key={d}
            onClick={() => {
              reset()
              setDuration(d)
              setRemaining(d * 60)
            }}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium tabular-nums transition-all active:scale-95",
              duration === d
                ? "bg-accent-primary/20 text-accent-primary font-semibold border border-accent-primary/30"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-2",
            )}
          >
            {d}m
          </button>
        ))}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4">
        {running ? (
          <Button onClick={pause} size="lg" variant="outline" className="h-12 px-8 rounded-full border-border-subtle text-text-primary hover:bg-surface-2">
            <Pause className="mr-2 h-5 w-5 fill-current" /> Pause
          </Button>
        ) : (
          <Button onClick={start} size="lg" className="h-12 px-8 rounded-full bg-accent-primary text-surface-base hover:bg-accent-primary/90 font-semibold shadow-lg shadow-accent-primary/20">
            <Play className="mr-2 h-5 w-5 fill-current" /> Start Flow
          </Button>
        )}
        <Button onClick={reset} size="lg" variant="ghost" className="h-12 px-5 rounded-full text-text-secondary hover:text-text-primary">
          <RotateCcw className="mr-2 h-4 w-4" /> Reset
        </Button>
      </div>

      {/* Shortcut hint */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-disabled">
        <Keyboard className="h-3.5 w-3.5" />
        <span>Press <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle font-mono text-xs">Space</kbd> to toggle, <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle font-mono text-xs">R</kbd> to reset</span>
      </div>

      {/* Ambient Sound Selector */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary mr-1">
          <Music className="h-3.5 w-3.5 text-accent-primary" />
          <span>Soundscape:</span>
        </div>
        {(
          [
            ["none", "None", VolumeX],
            ["white", "White noise", Volume2],
            ["binaural", "Binaural (220Hz)", Volume2],
            ["lo-fi", "Lo-fi hum", Volume2],
          ] as [SoundPreset, string, typeof Volume2][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => changeSound(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all active:scale-95",
              sound === key
                ? "border-accent-primary bg-accent-primary/15 text-accent-primary font-medium shadow-[0_0_12px_rgba(124,158,255,0.15)]"
                : "border-border-subtle/80 bg-surface-1/60 text-text-secondary hover:text-text-primary hover:bg-surface-2",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {elapsed > 0 && !running && (
        <div className="animate-pop flex items-center gap-2 rounded-2xl border border-accent-success/30 bg-accent-success/10 px-4 py-2 text-sm text-accent-success font-medium">
          <Check className="h-4 w-4" />
          {Math.round(elapsed / 60)} minute{Math.round(elapsed / 60) > 1 ? "s" : ""} focused and logged.
        </div>
      )}

      {/* 🎉 Post-Focus Rest & Stretch Modal */}
      <PostFocusBreakModal
        open={breakModalOpen}
        onOpenChange={setBreakModalOpen}
        sessionMinutes={duration}
      />
    </div>
  )
}

