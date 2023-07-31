export interface PlaylistElementObject {
  id: string
  type: 'PlaylistElement'

  url: string
  position: number

  startTimestamp?: number
  stopTimestamp?: number
}
