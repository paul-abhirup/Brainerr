"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTasks } from "@/hooks/use-tasks"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Play, Pause, RotateCcw, Check, Music, Volume2, VolumeX, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

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
    toast.success("Session complete. Well done.")
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

  // §13.7 — defend the focus block against external meeting invites.
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
        // start after a tick so the new sound state is applied
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
    <div className="flex flex-col items-center space-y-8 py-6">
      <div>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Focus</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          One task, one block. Your calendar gets blocked so nothing double-books this time.
        </p>
      </div>

      {/* Task selector */}
      <div className="w-full max-w-md">
        <Select value={taskId || "none"} onValueChange={(v) => setTaskId(v === "none" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="What are you focusing on? (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No specific task</SelectItem>
            {(tasks ?? []).filter((t) => t.status !== "done").map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timer ring */}
      <div className="relative flex h-[320px] w-[320px] items-center justify-center">
        <svg viewBox="0 0 320 320" className="h-full w-full -rotate-90">
          <circle cx="160" cy="160" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
          <circle
            cx="160"
            cy="160"
            r={R}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * progress}
            className="transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
        <div className="absolute text-center">
          <div className="font-mono text-6xl font-semibold tabular-nums tracking-tight">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          {running ? (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-accent-warm">
              <Flame className="h-4 w-4" />
              in flow
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">{duration} min · break on</p>
          )}
        </div>
      </div>

      {/* Duration picker */}
      <div className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-1 p-1">
        {DURATIONS.map((d) => (
          <button
            key={d}
            onClick={() => {
              reset()
              setDuration(d)
              setRemaining(d * 60)
            }}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm tabular-nums transition-colors",
              duration === d ? "bg-surface-3 text-text-primary" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {d}m
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {running ? (
          <Button onClick={pause} size="lg" variant="outline">
            <Pause className="mr-2 h-4 w-4" /> Pause
          </Button>
        ) : (
          <Button onClick={start} size="lg">
            <Play className="mr-2 h-4 w-4" /> Start
          </Button>
        )}
        <Button onClick={reset} size="lg" variant="ghost">
          <RotateCcw className="mr-2 h-4 w-4" /> Reset
        </Button>
      </div>

      {/* Ambient sound */}
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4 text-text-secondary" />
        {(
          [
            ["none", "None", VolumeX],
            ["white", "White noise", Volume2],
            ["binaural", "Binaural", Volume2],
            ["lo-fi", "Lo-fi", Volume2],
          ] as [SoundPreset, string, typeof Volume2][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => changeSound(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
              sound === key
                ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                : "border-border-subtle text-text-secondary hover:text-text-primary",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {elapsed > 0 && !running && (
        <p className="flex items-center gap-1.5 text-sm text-accent-success">
          <Check className="h-4 w-4" />
          {Math.round(elapsed / 60)} minute{Math.round(elapsed / 60) > 1 ? "s" : ""} focused and logged.
        </p>
      )}
    </div>
  )
}
