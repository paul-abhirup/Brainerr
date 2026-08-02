export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TaskStatus = "todo" | "in_progress" | "done" | "snoozed"
export type Priority = "low" | "medium" | "high"
export type Effort = "low" | "medium" | "high"
export type GoalHorizon = "long_term" | "monthly" | "weekly"
export type GoalStatus = "active" | "done" | "archived"
export type HabitFrequency = "daily" | "weekly" | "custom"

type AllOptional<T> = { [K in keyof T]?: T[K] | null }

interface Table<T extends { Row: Record<string, unknown> }> {
  Row: T["Row"]
  Insert: AllOptional<T["Row"]>
  Update: AllOptional<T["Row"]>
  Relationships: []
}

type TableDef<T extends { Row: Record<string, unknown> }> = Table<T>

export interface Database {
  public: {
    Tables: {
      goals: TableDef<{
        Row: {
          id: string
          user_id: string
          parent_goal_id: string | null
          title: string
          description: string | null
          horizon: GoalHorizon
          target_date: string | null
          status: GoalStatus
          created_at: string
          updated_at: string
        }
      }>
      projects: TableDef<{
        Row: {
          id: string
          user_id: string
          goal_id: string | null
          name: string
          color: string | null
          created_at: string
          updated_at: string
        }
      }>
      tasks: TableDef<{
        Row: {
          id: string
          user_id: string
          project_id: string | null
          parent_task_id: string | null
          title: string
          description: string | null
          due_date: string | null
          scheduled_start: string | null
          scheduled_end: string | null
          priority: Priority
          effort: Effort | null
          dread_level: number | null
          status: TaskStatus
          reschedule_count: number
          recurring_rule: string | null
          google_event_id: string | null
          estimated_minutes: number | null
          actual_minutes: number | null
          is_pinned: boolean
          at_risk: boolean
          blocked_by_task_id: string | null
          completed_at: string | null
          last_touched_at: string
          created_at: string
          updated_at: string
        }
      }>
      task_dependencies: TableDef<{
        Row: {
          id: string
          user_id: string
          task_id: string
          depends_on_task_id: string
        }
      }>
      habits: TableDef<{
        Row: {
          id: string
          user_id: string
          title: string
          frequency: HabitFrequency
          target_days_per_week: number
          active: boolean
          current_streak: number
          best_streak: number
          streak_frozen: boolean
          created_at: string
          updated_at: string
        }
      }>
      habit_logs: TableDef<{
        Row: {
          id: string
          habit_id: string
          user_id: string
          date: string
          completed: boolean
        }
      }>
      notes: TableDef<{
        Row: {
          id: string
          user_id: string
          title: string | null
          body: string | null
          tags: string[]
          linked_task_id: string | null
          linked_goal_id: string | null
          linked_project_id: string | null
          created_at: string
          updated_at: string
        }
      }>
      focus_sessions: TableDef<{
        Row: {
          id: string
          user_id: string
          task_id: string | null
          duration_minutes: number
          completed: boolean
          started_at: string
          completed_at: string | null
        }
      }>
      daily_focus: TableDef<{
        Row: {
          id: string
          user_id: string
          date: string
          task_ids: string[]
        }
      }>
      user_state: TableDef<{
        Row: {
          user_id: string
          last_active_task_id: string | null
          last_active_note_id: string | null
          mood_energy: "low" | "medium" | "high" | null
          last_mood_checkin: string | null
          last_opened_at: string
          updated_at: string
        }
      }>
      achievements: TableDef<{
        Row: {
          id: string
          user_id: string
          type: string
          points: number
          earned_at: string
        }
      }>
      push_subscriptions: TableDef<{
        Row: {
          id: string
          user_id: string
          endpoint: string
          keys: Json
          created_at: string
        }
      }>
      reminder_log: TableDef<{
        Row: {
          id: string
          user_id: string
          task_id: string | null
          scheduled_for: string
          sent_at: string
        }
      }>
      calendar_integrations: TableDef<{
        Row: {
          user_id: string
          provider: string
          refresh_token_encrypted: string | null
          access_token: string | null
          token_expiry: string | null
          calendar_id: string | null
          last_synced_at: string | null
          updated_at: string
        }
      }>
      user_settings: TableDef<{
        Row: {
          user_id: string
          working_hours: Json
          buffer_minutes: number
          max_daily_task_minutes: number
          scheduling_horizon_days: number
          weekly_review_at: string | null
          reminders_enabled: boolean
          created_at: string
          updated_at: string
        }
      }>
      scheduling_feedback: TableDef<{
        Row: {
          id: string
          user_id: string
          task_id: string
          suggested_start: string
          user_chosen_start: string
          created_at: string
        }
      }>
      productivity_patterns: TableDef<{
        Row: {
          user_id: string
          hour_of_day: number
          completion_rate: number | null
        }
      }>
      estimate_calibration: TableDef<{
        Row: {
          user_id: string
          project_id: string | null
          multiplier: number
          sample_count: number
        }
      }>
      goal_templates: TableDef<{
        Row: {
          id: string
          user_id: string
          name: string
          goal_title: string
          goal_description: string | null
          horizon: GoalHorizon
          data: Json
          created_at: string
        }
      }>
      calendar_busy: TableDef<{
        Row: {
          id: string
          user_id: string
          event_id: string
          title: string | null
          start: string
          end: string
          synced_at: string
        }
      }>
    }
    Views: {
      goal_progress: {
        Row: {
          goal_id: string
          user_id: string
          title: string
          total_tasks: number
          done_tasks: number
          progress_pct: number
        }
        Relationships: []
      }
      daily_task_stats: {
        Row: {
          user_id: string
          day: string
          completed: number
          open: number
        }
        Relationships: []
      }
      goal_forecast: {
        Row: {
          goal_id: string
          user_id: string
          title: string
          target_date: string | null
          done_per_week: number
          remaining_tasks: number
          projected_completion: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_owner: {
        Args: { user_id: string }
        Returns: boolean
      }
      compute_habit_streak: {
        Args: { p_habit_id: string }
        Returns: number
      }
      award_points: {
        Args: { p_user: string; p_type: string; p_points: number }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
