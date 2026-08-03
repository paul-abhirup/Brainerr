import { NextResponse } from "next/server"
import { GoogleGenAI, Type } from "@google/genai"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const user = (await supabase.auth.getUser()).data.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { energyLevel } = await req.json()

    // Fetch open tasks
    const tasksRes = await supabase.from("tasks").select("*").eq("user_id", user.id).neq("status", "done")

    const openTasks = tasksRes.data ?? []
    if (openTasks.length === 0) {
      return NextResponse.json({ plan: [], message: "No open tasks to schedule!" })
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
              text: `Select 3 to 5 tasks from this open task list to create an optimal daily schedule for an ADHD user with '${energyLevel || "medium"}' energy today.
              
Open tasks: ${JSON.stringify(openTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, dread: t.dread_level, effort: t.effort, estimatedMinutes: t.estimated_minutes, due: t.due_date })))}

Rules:
- High energy: Pick 1 high-dread/high-priority task first ("eat the frog"), followed by 2-3 medium tasks.
- Low energy: Pick 3 low-dread/low-effort quick win tasks.
- Return the task IDs in recommended execution order with brief reasoning for each step.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            big3TaskIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of task IDs selected for today's Big 3",
            },
            strategyReasoning: { type: Type.STRING, description: "Short motivational strategy summary" },
          },
          required: ["big3TaskIds", "strategyReasoning"],
        },
      },
    })

    const plan = JSON.parse(response.text || "{}")
    return NextResponse.json(plan)
  } catch (error) {
    console.error("AI Plan Day Error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
