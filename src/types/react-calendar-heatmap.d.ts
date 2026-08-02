declare module "react-calendar-heatmap" {
  import type { ComponentType } from "react"

  export interface HeatmapValue {
    date: Date | string | number
    count?: number
    [key: string]: unknown
  }

  interface CalendarHeatmapProps {
    startDate: Date | string | number
    endDate: Date | string | number
    values?: HeatmapValue[]
    classForValue?: (value: HeatmapValue | null) => string
    titleForValue?: (value: HeatmapValue | null) => string
    showMonthLabels?: boolean
    showWeekdayLabels?: boolean
    horizontal?: boolean
    gutterSize?: number
    monthLabels?: string[]
    weekdayLabels?: string[]
  }

  const CalendarHeatmap: ComponentType<CalendarHeatmapProps>
  export default CalendarHeatmap
}
