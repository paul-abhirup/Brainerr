"use client"

import { useState, useMemo } from "react"
import { useTasks, type TaskRow } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Network,
  Grid2X2,
  ScatterChart as ScatterIcon,
  GanttChart,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Flame,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

type ViewMode = "graph" | "matrix" | "dread" | "timeline"

export default function VisualizerPage() {
  const { data: tasks, isLoading: tasksLoading } = useTasks()
  const { data: projects } = useProjects()
  const [viewMode, setViewMode] = useState<ViewMode>("graph")
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null)
  const [filterProject, setFilterProject] = useState<string>("all")

  const filteredTasks = useMemo(() => {
    if (!tasks) return []
    if (filterProject === "all") return tasks
    return tasks.filter((t) => t.project_id === filterProject)
  }, [tasks, filterProject])

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Task Visualizers
            <Badge variant="outline" className="border-accent-primary/30 text-accent-primary bg-accent-primary/10">
              <Sparkles className="mr-1 h-3 w-3" /> Visual Brain
            </Badge>
          </span>
        }
        description="Multi-dimensional graphical views of your workload. Choose the perspective that fits your current focus."
        actions={
          <div className="w-48">
            <Select value={filterProject} onValueChange={(v) => setFilterProject(v ?? "all")}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-1 border-border-subtle text-xs">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Projects</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle/80 bg-surface-1/90 p-1.5 backdrop-blur-md">
        <button
          onClick={() => setViewMode("graph")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95",
            viewMode === "graph"
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30 shadow-sm"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <Network className="h-4 w-4" />
          Graph / Mindmap View
        </button>

        <button
          onClick={() => setViewMode("matrix")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95",
            viewMode === "matrix"
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30 shadow-sm"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <Grid2X2 className="h-4 w-4" />
          Eisenhower 2x2
        </button>

        <button
          onClick={() => setViewMode("dread")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95",
            viewMode === "dread"
              ? "bg-accent-warm/20 text-accent-warm border border-accent-warm/30 shadow-sm"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <ScatterIcon className="h-4 w-4" />
          Dread vs. Effort Map
        </button>

        <button
          onClick={() => setViewMode("timeline")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95",
            viewMode === "timeline"
              ? "bg-accent-success/20 text-accent-success border border-accent-success/30 shadow-sm"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <GanttChart className="h-4 w-4" />
          Timeline Gantt
        </button>
      </div>

      {/* Main Visualizer Area */}
      {tasksLoading ? (
        <div className="flex h-96 items-center justify-center rounded-xl border border-border-subtle bg-surface-1 shimmer">
          <p className="text-sm text-text-secondary">Generating visual representation…</p>
        </div>
      ) : (
        <div className="relative">
          {viewMode === "graph" && (
            <TaskGraphVisualizer tasks={filteredTasks} onSelectTask={setSelectedTask} />
          )}

          {viewMode === "matrix" && (
            <EisenhowerMatrixVisualizer tasks={filteredTasks} onSelectTask={setSelectedTask} />
          )}

          {viewMode === "dread" && (
            <DreadEffortMatrixVisualizer tasks={filteredTasks} onSelectTask={setSelectedTask} />
          )}

          {viewMode === "timeline" && (
            <TimelineGanttVisualizer tasks={filteredTasks} onSelectTask={setSelectedTask} />
          )}
        </div>
      )}

      {/* Task Details Drawer/Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <Card size="lg" className="w-full max-w-lg gap-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider mb-2",
                    selectedTask.status === "done" && "border-accent-success/30 text-accent-success bg-accent-success/10",
                    selectedTask.status === "in_progress" && "border-accent-primary/30 text-accent-primary bg-accent-primary/10",
                    selectedTask.status === "todo" && "border-border-subtle text-text-secondary bg-surface-2",
                  )}
                >
                  {selectedTask.status.replace("_", " ")}
                </Badge>
                <h3 className="text-xl font-bold text-text-primary">{selectedTask.title}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)} className="rounded-xl">
                ✕
              </Button>
            </div>

            {selectedTask.description && (
              <p className="text-sm text-text-secondary bg-surface-2/60 p-3 rounded-xl border border-border-subtle/50">
                {selectedTask.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border-subtle p-3 bg-surface-2/40">
                <span className="text-text-disabled block mb-1">Dread Level</span>
                <span className="font-semibold text-accent-warm flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5" /> Level {selectedTask.dread_level ?? 1}/5
                </span>
              </div>

              <div className="rounded-xl border border-border-subtle p-3 bg-surface-2/40">
                <span className="text-text-disabled block mb-1">Due Date</span>
                <span className="font-semibold text-text-primary flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {selectedTask.due_date ? format(new Date(selectedTask.due_date), "MMM d, yyyy") : "No due date"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedTask(null)} className="rounded-xl bg-accent-primary text-surface-base">
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   1. GRAPH / MINDMAP VISUALIZER (Interactive Node-Link Map)
   ========================================================================= */
function TaskGraphVisualizer({
  tasks,
  onSelectTask,
}: {
  tasks: TaskRow[]
  onSelectTask: (t: TaskRow) => void
}) {
  const [zoom, setZoom] = useState(1)

  // Layout node positions dynamically in radial / cluster arrangement
  const graphNodes = useMemo(() => {
    if (!tasks || tasks.length === 0) return []
    const centerX = 400
    const centerY = 300
    const radius = Math.min(260, 140 + tasks.length * 8)

    return tasks.map((t, i) => {
      const angle = (i / tasks.length) * 2 * Math.PI
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      return { task: t, x, y }
    })
  }, [tasks])

  return (
    <Card className="glass-card border-border-subtle/80 overflow-hidden shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-subtle/50 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-4 w-4 text-accent-primary" />
            Interactive Task Graph Map
          </CardTitle>
          <CardDescription>
            Visual network showing active tasks and their inter-relationships
          </CardDescription>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2/80 p-1">
          <button
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
            className="p-1 text-text-secondary hover:text-text-primary"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-mono tabular-nums text-text-secondary">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            className="p-1 text-text-secondary hover:text-text-primary"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 text-text-secondary hover:text-text-primary border-l border-border-subtle pl-1.5"
            title="Reset Zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-auto flex justify-center bg-surface-base/50 min-h-[500px]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-disabled">
            <Network className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm font-medium">No tasks found for graph rendering</p>
          </div>
        ) : (
          <div className="relative w-[800px] h-[600px] overflow-hidden">
            <svg
              viewBox="0 0 800 600"
              className="w-full h-full transition-transform duration-300"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            >
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Central Core Brainer Hub Node */}
              <circle
                cx="400"
                cy="300"
                r="36"
                fill="var(--surface-1)"
                stroke="var(--accent-primary)"
                strokeWidth="2.5"
                filter="url(#glow)"
              />
              <text
                x="400"
                y="304"
                textAnchor="middle"
                fill="var(--accent-primary)"
                fontSize="12"
                fontWeight="bold"
                className="pointer-events-none uppercase tracking-wider"
              >
                2nd Brain
              </text>

              {/* Connecting Lines to Task Nodes */}
              {graphNodes.map(({ task, x, y }) => (
                <line
                  key={`line-${task.id}`}
                  x1="400"
                  y1="300"
                  x2={x}
                  y2={y}
                  stroke={
                    task.status === "done"
                      ? "var(--accent-success)"
                      : task.status === "in_progress"
                      ? "var(--accent-primary)"
                      : "var(--border-subtle)"
                  }
                  strokeWidth={task.status === "in_progress" ? "2" : "1.2"}
                  strokeDasharray={task.status === "todo" ? "4 4" : "none"}
                  opacity="0.6"
                />
              ))}

              {/* Task Nodes */}
              {graphNodes.map(({ task, x, y }) => {
                const isDone = task.status === "done"
                const isInProgress = task.status === "in_progress"
                const nodeColor = isDone
                  ? "var(--accent-success)"
                  : isInProgress
                  ? "var(--accent-primary)"
                  : "var(--accent-warm)"

                return (
                  <g
                    key={`node-${task.id}`}
                    onClick={() => onSelectTask(task)}
                    className="cursor-pointer group"
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r="22"
                      fill="var(--surface-1)"
                      stroke={nodeColor}
                      strokeWidth="2"
                      className="transition-all group-hover:scale-125"
                    />
                    <circle cx={x} cy={y} r="6" fill={nodeColor} />
                    <text
                      x={x}
                      y={y + 36}
                      textAnchor="middle"
                      fill="var(--text-primary)"
                      fontSize="11"
                      fontWeight="500"
                      className="pointer-events-none drop-shadow-md select-none"
                    >
                      {task.title.length > 16 ? task.title.slice(0, 15) + "…" : task.title}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* =========================================================================
   2. EISENHOWER MATRIX (2x2 Priority / Urgency Grid)
   ========================================================================= */
function getPriorityValue(p: string | null | undefined): number {
  if (p === "high") return 3
  if (p === "medium") return 2
  return 1
}

function EisenhowerMatrixVisualizer({
  tasks,
  onSelectTask,
}: {
  tasks: TaskRow[]
  onSelectTask: (t: TaskRow) => void
}) {
  const quadrants = useMemo(() => {
    const q1 = tasks.filter((t) => getPriorityValue(t.priority) >= 3 && t.due_date && t.status !== "done")
    const q2 = tasks.filter((t) => getPriorityValue(t.priority) >= 3 && !t.due_date && t.status !== "done")
    const q3 = tasks.filter((t) => getPriorityValue(t.priority) < 3 && t.due_date && t.status !== "done")
    const q4 = tasks.filter((t) => getPriorityValue(t.priority) < 3 && !t.due_date && t.status !== "done")
    return { q1, q2, q3, q4 }
  }, [tasks])


  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Q1: Do First */}
      <Card className="glass-card border-accent-danger/40 bg-accent-danger/5 shadow-lg">
        <CardHeader className="pb-3 border-b border-accent-danger/20">
          <CardTitle className="text-sm font-bold text-accent-danger flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> 🔴 Q1: Do First (Urgent & High Priority)
            </span>
            <Badge variant="outline" className="border-accent-danger/30 text-accent-danger">
              {quadrants.q1.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2 max-h-72 overflow-y-auto">
          {quadrants.q1.length === 0 ? (
            <p className="text-xs text-text-disabled py-4 text-center">No urgent high-priority tasks</p>
          ) : (
            quadrants.q1.map((t) => (
              <div
                key={t.id}
                onClick={() => onSelectTask(t)}
                className="p-3 rounded-xl border border-border-subtle bg-surface-1/90 hover:border-accent-danger/60 cursor-pointer transition-all text-xs font-medium flex items-center justify-between"
              >
                <span className="truncate">{t.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-accent-danger shrink-0" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Q2: Schedule */}
      <Card className="glass-card border-accent-primary/40 bg-accent-primary/5 shadow-lg">
        <CardHeader className="pb-3 border-b border-accent-primary/20">
          <CardTitle className="text-sm font-bold text-accent-primary flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> 🔵 Q2: Schedule (High Priority, Not Urgent)
            </span>
            <Badge variant="outline" className="border-accent-primary/30 text-accent-primary">
              {quadrants.q2.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2 max-h-72 overflow-y-auto">
          {quadrants.q2.length === 0 ? (
            <p className="text-xs text-text-disabled py-4 text-center">No tasks in schedule matrix</p>
          ) : (
            quadrants.q2.map((t) => (
              <div
                key={t.id}
                onClick={() => onSelectTask(t)}
                className="p-3 rounded-xl border border-border-subtle bg-surface-1/90 hover:border-accent-primary/60 cursor-pointer transition-all text-xs font-medium flex items-center justify-between"
              >
                <span className="truncate">{t.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-accent-primary shrink-0" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Q3: Delegate / Quick Wins */}
      <Card className="glass-card border-accent-warm/40 bg-accent-warm/5 shadow-lg">
        <CardHeader className="pb-3 border-b border-accent-warm/20">
          <CardTitle className="text-sm font-bold text-accent-warm flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Flame className="h-4 w-4" /> 🟡 Q3: Quick Wins (Urgent, Low Complexity)
            </span>
            <Badge variant="outline" className="border-accent-warm/30 text-accent-warm">
              {quadrants.q3.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2 max-h-72 overflow-y-auto">
          {quadrants.q3.length === 0 ? (
            <p className="text-xs text-text-disabled py-4 text-center">No urgent low-complexity tasks</p>
          ) : (
            quadrants.q3.map((t) => (
              <div
                key={t.id}
                onClick={() => onSelectTask(t)}
                className="p-3 rounded-xl border border-border-subtle bg-surface-1/90 hover:border-accent-warm/60 cursor-pointer transition-all text-xs font-medium flex items-center justify-between"
              >
                <span className="truncate">{t.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-accent-warm shrink-0" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Q4: Backlog */}
      <Card className="glass-card border-border-subtle bg-surface-1/40 shadow-lg">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-sm font-bold text-text-secondary flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> ⚪ Q4: Backlog (Low Priority & Low Urgency)
            </span>
            <Badge variant="outline" className="border-border-subtle text-text-secondary">
              {quadrants.q4.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2 max-h-72 overflow-y-auto">
          {quadrants.q4.length === 0 ? (
            <p className="text-xs text-text-disabled py-4 text-center">No tasks in low-priority backlog</p>
          ) : (
            quadrants.q4.map((t) => (
              <div
                key={t.id}
                onClick={() => onSelectTask(t)}
                className="p-3 rounded-xl border border-border-subtle bg-surface-1/90 hover:border-text-secondary cursor-pointer transition-all text-xs font-medium flex items-center justify-between"
              >
                <span className="truncate text-text-secondary">{t.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-text-disabled shrink-0" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* =========================================================================
   3. DREAD VS. EFFORT MATRIX (ADHD Dopamine Map)
   ========================================================================= */
function DreadEffortMatrixVisualizer({
  tasks,
  onSelectTask,
}: {
  tasks: TaskRow[]
  onSelectTask: (t: TaskRow) => void
}) {
  return (
      <Card className="glass-card border-border-subtle/80 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScatterIcon className="h-4 w-4 text-accent-warm" />
              Dread Level vs. Effort Matrix (ADHD Dopamine Map)
            </CardTitle>
            <CardDescription>
              Identify low-dread &quot;easy dopamine&quot; wins versus high-dread barrier tasks.
            </CardDescription>
          </div>
        </div>

      <div className="grid grid-cols-5 gap-2 pt-4">
        {[1, 2, 3, 4, 5].map((dread) => (
          <div key={dread} className="space-y-2">
            <div className="text-center text-xs font-semibold text-accent-warm border-b border-border-subtle pb-1">
              Dread {dread} 🔥
            </div>
            <div className="space-y-2 min-h-[280px] bg-surface-2/30 rounded-xl p-2 border border-border-subtle/40">
              {tasks
                .filter((t) => (t.dread_level ?? 1) === dread && t.status !== "done")
                .map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask(t)}
                    className="p-2.5 rounded-lg bg-surface-1 border border-border-subtle hover:border-accent-warm cursor-pointer transition-all text-xs"
                  >
                    <p className="font-semibold truncate text-text-primary">{t.title}</p>
                    <span className="text-xs text-text-disabled capitalize block mt-1">
                      Effort: {t.effort ?? "low"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* =========================================================================
   4. TIMELINE / GANTT HORIZON VISUALIZER
   ========================================================================= */
function TimelineGanttVisualizer({
  tasks,
  onSelectTask,
}: {
  tasks: TaskRow[]
  onSelectTask: (t: TaskRow) => void
}) {
  const datedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
  }, [tasks])

  return (
      <Card className="glass-card border-border-subtle/80 shadow-2xl p-6 space-y-4">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-2">
            <GanttChart className="h-4 w-4 text-accent-success" />
            Timeline & Due Date Horizon
          </CardTitle>
          <CardDescription>
            Chronological horizon of tasks scheduled across dates
          </CardDescription>
        </CardHeader>

      <div className="space-y-3 pt-2">
        {datedTasks.length === 0 ? (
          <p className="text-xs text-text-disabled py-10 text-center">No dated tasks to display on timeline</p>
        ) : (
          datedTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelectTask(t)}
              className="flex items-center gap-4 rounded-xl border border-border-subtle/70 bg-surface-1/80 p-3 hover:border-accent-success/50 cursor-pointer transition-all"
            >
              <div className="w-28 shrink-0 text-xs font-semibold tabular-nums text-accent-success flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(t.due_date!), "MMM d, yyyy")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{t.title}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  t.status === "done" && "border-accent-success text-accent-success bg-accent-success/10",
                  t.status === "in_progress" && "border-accent-primary text-accent-primary bg-accent-primary/10",
                )}
              >
                {t.status}
              </Badge>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
