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

    const { completedCount, habitRate, focusMinutes, rescheduleCount } = await req.json()

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
              text: `Synthesize a weekly productivity review for an ADHD user based on these metrics:
              - Completed Tasks This Week: ${completedCount}
              - Habit Completion Rate: ${habitRate}%
              - Total Focus Time Logged: ${focusMinutes} minutes
              - Tasks Rescheduled 3+ Times: ${rescheduleCount}

              Provide an encouraging summary and 3 concrete recommendations for next week.`,
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
            summary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["headline", "summary", "recommendations"],
        },
      },
    })

    const review = JSON.parse(response.text || "{}")
    return NextResponse.json(review)
  } catch (error) {
    console.error("AI Weekly Review Error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
