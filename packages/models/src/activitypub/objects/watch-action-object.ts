export interface WatchActionObject {
  id: string
  type: 'WatchAction'

  startTime: string
  endTime: string

  location?: {
    addressCountry: string
    addressRegion: string
  }

  uuid: string
  object: string
  actionStatus: 'CompletedActionStatus'

  duration: string

  watchSections: {
    startTimestamp: number
    endTimestamp: number
  }[]
}
