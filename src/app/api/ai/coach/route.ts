import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const user = (await supabase.auth.getUser()).data.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messages, userEnergy } = await req.json()

    // Fetch user context: open tasks, habits, focus logs
    const [tasksRes, habitsRes, dailyFocusRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).neq("status", "done"),
      supabase.from("habits").select("*").eq("user_id", user.id),
      supabase.from("daily_focus").select("*").eq("user_id", user.id).eq("date", new Date().toISOString().split("T")[0]).single(),
    ])

    const openTasks = tasksRes.data ?? []
    const habits = habitsRes.data ?? []
    const dailyFocus = dailyFocusRes.data ?? { task_ids: [] }

    const overdueCount = openTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date()).length
    const taskIds = (dailyFocus?.task_ids as string[] | null) ?? []
    const big3Tasks = openTasks.filter((t) => taskIds.includes(t.id)).map((t) => t.title)
    const habitStreaks = habits.map((h) => `${h.title}: ${h.current_streak} days`)

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || ""
    if (!apiKey) {
      return NextResponse.json({
        reply: "AI key is not configured in environment variables. Please add GEMINI_API_KEY or OPENAI_API_KEY to your .env.local file.",
      })
    }

    const ai = new GoogleGenAI({ apiKey })

    const systemPrompt = `You are Brainer AI Coach, a supportive, empathetic, and hyper-actionable AI assistant for an ADHD 2nd brain productivity app.

Philosophies:
- Low pressure, zero shame. Always break things down into tiny 2-15 min steps.
- Prioritize dopamine wins when energy is low.
- Keep answers skimmable with bullet points & emoji.

User Context Today:
- Energy State: ${userEnergy || "medium"}
- Today: ${new Date().toISOString().split("T")[0]}
- Open Tasks (${openTasks.length}): ${JSON.stringify(openTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, dread: t.dread_level, effort: t.effort, due: t.due_date })))}
- Overdue Tasks Count: ${overdueCount}
- Today's Big 3 Focus: ${JSON.stringify(big3Tasks)}
- Habit Streaks: ${JSON.stringify(habitStreaks)}`

    const formattedContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }))

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    })

    return NextResponse.json({
      reply: response.text || "I'm here to help you smash task paralysis! What would you like to tackle next?",
    })
  } catch (error) {
    console.error("AI Coach Error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
