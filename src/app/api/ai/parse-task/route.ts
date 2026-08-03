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

    const { text } = await req.json()
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
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
              text: `Extract structured task details from this raw input: "${text}". Today's date is ${new Date().toISOString().split("T")[0]}.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Clean task title" },
            dueDate: { type: Type.STRING, description: "ISO YYYY-MM-DD due date if mentioned, else null" },
            priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
            effort: { type: Type.STRING, enum: ["low", "medium", "high"] },
            dreadLevel: { type: Type.INTEGER, description: "Dread level from 1 (easy win) to 5 (avoided)" },
            estimatedMinutes: { type: Type.INTEGER, description: "Estimated time in minutes if implied" },
          },
          required: ["title", "priority", "effort", "dreadLevel"],
        },
      },
    })

    const parsed = JSON.parse(response.text || "{}")
    return NextResponse.json(parsed)
  } catch (error) {
    console.error("AI Parse Task Error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
