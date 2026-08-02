export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Goal</h1>
      <p className="mt-2 text-sm text-muted-foreground">{id}</p>
    </div>
  )
}
