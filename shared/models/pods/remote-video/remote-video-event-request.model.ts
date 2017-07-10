export type RemoteVideoEventType = 'views' | 'likes' | 'dislikes'

export interface RemoteVideoEventData {
  remoteId: string
  eventType: RemoteVideoEventType
  count: number
}

export interface RemoteVideoEventRequest {
  data: RemoteVideoEventData
}
