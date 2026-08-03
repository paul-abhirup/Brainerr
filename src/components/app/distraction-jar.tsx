"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Trash2, Plus, Inbox, Lightbulb } from "lucide-react"

function loadJar(): { id: string; text: string; time: string }[] {
  if (typeof window === "undefined") return []
  try {
    const saved = localStorage.getItem("brainer_distraction_jar")
    return saved ? (JSON.parse(saved) as { id: string; text: string; time: string }[]) : []
  } catch {
    return []
  }
}

export function DistractionJar() {
  const [open, setOpen] = useState(false)
  const [thought, setThought] = useState("")
  const [jarItems, setJarItems] = useState(loadJar)
  const supabase = createClient()
  const qc = useQueryClient()

  function saveThought(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!thought.trim()) return
    const newItem = {
      id: String(Date.now()),
      text: thought.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    const updated = [newItem, ...jarItems]
    setJarItems(updated)
    localStorage.setItem("brainer_distraction_jar", JSON.stringify(updated))
    setThought("")
    toast.success("Thought parked in jar 🫙 — Back to flow!")
  }

  function removeItem(id: string) {
    const updated = jarItems.filter((i) => i.id !== id)
    setJarItems(updated)
    localStorage.setItem("brainer_distraction_jar", JSON.stringify(updated))
  }

  async function convertToInboxTask(id: string, text: string) {
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error("User not authenticated")
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: text,
        status: "todo",
      })
      if (error) throw error
      removeItem(id)
      await qc.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Moved to Inbox task")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  function clearJar() {
    setJarItems([])
    localStorage.removeItem("brainer_distraction_jar")
    toast.success("Distraction jar emptied")
  }

  return (
    <>
      {/* Floating Jar Button (bottom-left above mobile nav, right of the sidebar on desktop) */}
      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 md:left-72 md:bottom-6 z-40">
        <button
          onClick={() => setOpen(true)}
          aria-label="Distraction Jar — Park random thoughts"
          className="group flex items-center gap-2 rounded-full border border-amber-500/30 bg-card/90 px-3.5 py-2 text-xs font-semibold backdrop-blur-xl shadow-lg transition-all hover:border-amber-500/60 hover:bg-secondary active:scale-95"
        >
          <span className="text-base">🫙</span>
          <span className="hidden sm:inline text-foreground font-medium">Distraction Jar</span>
          {jarItems.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
              {jarItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Jar Dialog Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>🫙 Distraction Jar</span>
              <span className="text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                ADHD Brain Saver
              </span>
            </DialogTitle>
            <DialogDescription>
              Got a random thought during focus? Park it here instantly so your brain lets go of it without breaking flow.
            </DialogDescription>
          </DialogHeader>

          {/* Quick Input Form */}
          <form onSubmit={saveThought} className="flex gap-2 pt-2">
            <Input
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              placeholder="e.g. Look up mechanical switches later…"
              className="focus-visible:ring-amber-500"
              autoFocus
            />
            <Button type="submit" disabled={!thought.trim()} className="border border-amber-500/30 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
              <Plus className="h-4 w-4" />
              Park
            </Button>
          </form>

          {/* Parked Thoughts List */}
          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
            {jarItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-disabled">
                <Lightbulb className="h-6 w-6 text-amber-500/40 mb-1" />
                <p className="text-xs">Your jar is empty. Flow state secured!</p>
              </div>
            ) : (
              jarItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/50 p-3 text-xs"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium text-foreground truncate">{item.text}</span>
                    <span className="text-xs text-disabled">{item.time}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => convertToInboxTask(item.id, item.text)}
                      title="Move to Inbox Task"
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-primary"
                    >
                      <Inbox className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      title="Discard"
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {jarItems.length > 0 && (
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={clearJar} className="text-xs text-disabled hover:text-muted-foreground">
                Empty jar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
