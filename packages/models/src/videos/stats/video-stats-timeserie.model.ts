export interface VideoStatsTimeserie {
  groupInterval: string

  data: {
    date: string
    value: number
  }[]
}
