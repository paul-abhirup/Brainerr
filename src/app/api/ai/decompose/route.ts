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

    const { title, description } = await req.json()
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
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
              text: `Decompose the following high-level task into 3 to 6 actionable, low-friction micro-subtasks for an ADHD user. Each subtask should take 5 to 25 minutes maximum.\nTask: "${title}"\nDescription: "${description || "None"}"`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              estimatedMinutes: { type: Type.INTEGER },
              effort: { type: Type.STRING, enum: ["low", "medium", "high"] },
              dreadLevel: { type: Type.INTEGER },
            },
            required: ["title", "estimatedMinutes", "effort", "dreadLevel"],
          },
        },
      },
    })

    const subtasks = JSON.parse(response.text || "[]")
    return NextResponse.json({ subtasks })
  } catch (error) {
    console.error("AI Decompose Error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
