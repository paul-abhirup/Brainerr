import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const user = (await supabase.auth.getUser()).data.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title, estimatedMinutes } = await req.json()
    if (!title || !estimatedMinutes) {
      return NextResponse.json({ error: "Title and estimatedMinutes required" }, { status: 400 })
    }

    // Fetch user's historical estimates vs actuals
    const { data: historicalTasks } = await supabase
      .from("tasks")
      .select("estimated_minutes, actual_minutes")
      .eq("user_id", user.id)
      .eq("status", "done")
      .not("estimated_minutes", "is", null)
      .not("actual_minutes", "is", null)
      .limit(20)

    const calData = historicalTasks ?? []
    let multiplier = 1.3 // Default ADHD optimism multiplier

    if (calData.length >= 3) {
      const totalEst = calData.reduce((acc, t) => acc + (t.estimated_minutes ?? 0), 0)
      const totalAct = calData.reduce((acc, t) => acc + (t.actual_minutes ?? 0), 0)
      if (totalEst > 0) {
        multiplier = Math.round((totalAct / totalEst) * 10) / 10
      }
    }

    const suggestedMinutes = Math.round(estimatedMinutes * Math.max(1.1, multiplier))

    return NextResponse.json({
      originalMinutes: estimatedMinutes,
      suggestedMinutes,
      multiplier,
      reasoning: `Based on ${calData.length} completed tasks, your tasks take ~${multiplier}x longer than estimated. Adding buffer for flow state.`,
    })
  } catch (error) {
    console.error("AI Calibrate Estimate Error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
