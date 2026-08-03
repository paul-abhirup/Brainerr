import { NextResponse } from "next/server"
import { GoogleGenAI, Type } from "@google/genai"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createClient()
    const user = (await supabase.auth.getUser()).data.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "done")

    const openTasks = tasks ?? []
    const avoidedTasks = openTasks.filter(
      (t) => (t.reschedule_count ?? 0) >= 3 || (t.dread_level ?? 1) >= 4,
    )

    if (avoidedTasks.length === 0) {
      return NextResponse.json({ avoidedCount: 0, alerts: [] })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || ""
    if (!apiKey) {
      return NextResponse.json({ error: "AI Key missing" }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze these avoided/rescheduled tasks for an ADHD user and generate zero-shame, practical coping strategies for each:
              Tasks: ${JSON.stringify(avoidedTasks.map(t => ({ id: t.id, title: t.title, rescheduleCount: t.reschedule_count, dread: t.dread_level })))}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            alerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  taskTitle: { type: Type.STRING },
                  copingStrategy: { type: Type.STRING, description: "1-sentence 2-minute actionable micro step" },
                },
                required: ["taskId", "taskTitle", "copingStrategy"],
              },
            },
          },
          required: ["headline", "alerts"],
        },
      },
    })

    const analysis = JSON.parse(response.text || "{}")
    return NextResponse.json(analysis)
  } catch (error) {
    console.error("AI Dread Analysis Error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
