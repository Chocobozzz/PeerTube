export interface UserVideoHistoryExportJSON {
  watchedVideos: {
    videoUrl: string
    lastTimecode: number
    createdAt: string
    updatedAt: string

    archiveFiles?: never
  }[]
}
