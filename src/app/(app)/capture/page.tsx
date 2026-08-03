"use client"

import { useState, useRef, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTasks } from "@/hooks/use-tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardTitle } from "@/components/ui/card"
import { Mic, MicOff, Send, Sparkles, Inbox } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void
  onerror: () => void
  onend: () => void
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

export default function CapturePage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: tasks } = useTasks()

  const [inputVal, setInputVal] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [dumpedCount, setDumpedCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Web Speech API Voice Recognition setup
  useEffect(() => {
    if (typeof window === "undefined") return
    const w = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = "en-US"

    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) {
        setInputVal((prev) => (prev ? `${prev} ${transcript}` : transcript))
      }
      setIsListening(false)
    }

    rec.onerror = () => {
      setIsListening(false)
      toast.error("Voice input error or permission denied.")
    }

    rec.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = rec
  }, [])

  function toggleVoiceInput() {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser.")
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setIsListening(true)
      recognitionRef.current.start()
    }
  }

  async function handleDumpSubmit(e?: React.FormEvent, useAI = true) {
    if (e) e.preventDefault()
    const trimmed = inputVal.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error("Not authenticated")

      let taskPayload: {
        user_id: string
        title: string
        status: "todo" | "done" | "in_progress" | "snoozed"
        priority: "low" | "medium" | "high"
        effort: "low" | "medium" | "high"
        dread_level: number
        due_date?: string | null
        estimated_minutes?: number | null
      } = {
        user_id: user.id,
        title: trimmed,
        status: "todo",
        priority: "medium",
        effort: "low",
        dread_level: 1,
      }

      if (useAI) {
        try {
          const aiRes = await fetch("/api/ai/parse-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: trimmed }),
          })
          const aiData = await aiRes.json()
          if (aiData.title) {
            taskPayload = {
              ...taskPayload,
              title: aiData.title,
              due_date: aiData.dueDate || null,
              priority: aiData.priority || "medium",
              effort: aiData.effort || "low",
              dread_level: aiData.dreadLevel || 1,
              estimated_minutes: aiData.estimatedMinutes || null,
            }
          }
        } catch {
          // Fallback to basic payload if AI parsing fails
        }
      }

      const { error } = await supabase.from("tasks").insert(taskPayload)
      if (error) throw error

      setInputVal("")
      setDumpedCount((prev) => prev + 1)
      await qc.invalidateQueries({ queryKey: ["tasks"] })
      toast.success(`✨ AI Captured: "${taskPayload.title.length > 25 ? taskPayload.title.slice(0, 24) + "…" : taskPayload.title}"`, {
        duration: 2500,
      })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }

  // Filter tasks created today that are still in inbox status
  const recentDumps = (tasks ?? [])
    .filter((t) => t.status !== "done")
    .slice(0, 10)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero Header */}
      <div className="text-center space-y-2">
        <Badge className="bg-accent-primary/15 text-accent-primary border-accent-primary/30 font-bold uppercase tracking-wider text-xs px-3 py-1">
          ⚡ Zero-Friction Brain Dump
        </Badge>
        <h1 className="text-3xl font-black text-text-primary tracking-tight sm:text-4xl">
          Rapid Capture Engine
        </h1>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Get thoughts out of your head before they vanish. Type or speak — press Enter to capture instantly.
        </p>
      </div>

      {/* Main Input Box */}
      <Card className="glass-card border-2 border-accent-primary/40 shadow-2xl p-6 relative group">
        <form onSubmit={handleDumpSubmit} className="space-y-4">
          <div className="relative flex items-center">
            <Input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="What's on your mind? (e.g., Email Sarah, Buy batteries, Fix CSS bug)"
              className="h-16 text-lg font-medium pl-5 pr-28 rounded-xl bg-surface-2/90 border-border-subtle focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/20 transition-all"
            />

            <div className="absolute right-3 flex items-center gap-2">
              {/* Voice button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={cn(
                  "p-2.5 rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/60 outline-none",
                  isListening
                    ? "bg-accent-warm text-black animate-pulse"
                    : "bg-surface-1 text-text-secondary hover:text-accent-primary hover:bg-surface-3",
                )}
                title={isListening ? "Listening…" : "Voice input"}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={!inputVal.trim() || submitting}
                size="icon"
                className="h-10 w-10 rounded-xl bg-accent-primary text-white hover:bg-accent-primary/90 shadow-md cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-text-disabled px-2">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle font-mono text-xs">Enter ↵</kbd> to save & keep typing</span>
            {dumpedCount > 0 && (
              <span className="font-bold text-accent-success flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> {dumpedCount} captured this session
              </span>
            )}
          </div>
        </form>
      </Card>

      {/* Captured Items Triage Stack */}
      <Card className="glass-card border-border-subtle shadow-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Inbox className="h-4 w-4 text-accent-primary" />
            Recent Unprocessed Captures ({recentDumps.length})
          </CardTitle>
          <Badge variant="outline" className="text-xs text-text-secondary">
            Auto-saved to Inbox
          </Badge>
        </div>

        <div className="space-y-2">
          {recentDumps.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-disabled">
              Your capture queue is clear! Start typing above.
            </div>
          ) : (
            recentDumps.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl border border-border-subtle bg-surface-1/90 hover:border-accent-primary/50 transition-all flex items-center justify-between text-sm"
              >
                <span className="font-medium truncate text-text-primary flex-1 mr-4">{t.title}</span>
                <Badge variant="outline" className="text-xs uppercase text-text-disabled shrink-0">
                  Inbox
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
