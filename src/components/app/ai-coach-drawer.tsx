"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Brain, Send, Sparkles, Bot, User } from "lucide-react"
import { useUserState } from "@/hooks/use-data"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export function AICoachDrawer() {
  const { data: userState } = useUserState()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey there! I'm your AI Brain Coach. Feeling stuck, overwhelmed, or not sure what to start next? Ask me anything or pick a quick prompt below!",
    },
  ])
  const [inputVal, setInputVal] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSend(textToSend?: string) {
    const text = textToSend || inputVal.trim()
    if (!text || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    if (!textToSend) setInputVal("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          userEnergy: userState?.mood_energy || "medium",
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: data.reply },
      ])
    } catch (err) {
      toast.error((err as Error).message)
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "⚠️ Sorry, I encountered an error connecting to AI services. Please check your API key." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Brain Coach"
        className="fixed bottom-[calc(10rem+env(safe-area-inset-bottom))] left-4 md:left-auto md:bottom-6 md:right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary via-warning to-success p-0.5 shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer group"
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-card backdrop-blur-md">
          <Brain className="h-6 w-6 text-primary animate-pulse group-hover:rotate-12 transition-transform" />
        </div>
      </button>

      {/* Slide-out Sheet Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-card border-l-2 border-primary/30 shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 via-warning/20 to-primary/20 p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30">
                <Brain className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <SheetTitle className="text-base font-black text-foreground tracking-tight">
                  AI Brain Coach
                </SheetTitle>
                <p className="text-xs text-muted-foreground">ADHD-optimized triage assistant</p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs capitalize">
              Energy: {userState?.mood_energy || "med"}
            </Badge>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-3 text-xs leading-relaxed max-w-[88%]",
                  m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto",
                )}
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-primary-foreground font-bold text-xs",
                    m.role === "user" ? "bg-primary" : "bg-warning",
                  )}
                >
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>

                <div
                  className={cn(
                    "p-3.5 rounded-2xl space-y-1.5 shadow-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                      : "bg-secondary border border-border text-foreground rounded-tl-none",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-disabled py-2">
                <Sparkles className="h-4 w-4 text-primary animate-spin" />
                AI Coach is thinking…
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto border-t border-border/50 no-scrollbar">
            <button
              onClick={() => handleSend("What task should I start right now?")}
              className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full border border-border bg-secondary text-muted-foreground hover:text-primary hover:border-primary transition-all shrink-0 cursor-pointer"
            >
              🎯 What to do next?
            </button>
            <button
              onClick={() => handleSend("I'm feeling overwhelmed by my tasks.")}
              className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full border border-border bg-secondary text-muted-foreground hover:text-warning hover:border-warning transition-all shrink-0 cursor-pointer"
            >
              🧊 I&apos;m overwhelmed
            </button>
            <button
              onClick={() => handleSend("Give me a 3-step momentum plan.")}
              className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full border border-border bg-secondary text-muted-foreground hover:text-success hover:border-success transition-all shrink-0 cursor-pointer"
            >
              ⚡ 3-step momentum
            </button>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="p-3 border-t border-border flex items-center gap-2 bg-secondary/60"
          >
            <Input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask coach anything..."
              className="h-10 text-base sm:text-xs rounded-xl bg-card border-border focus:border-primary"
            />
            <Button
              type="submit"
              disabled={!inputVal.trim() || loading}
              size="icon"
              className="h-10 w-10 rounded-xl bg-primary text-primary-foreground shrink-0 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
