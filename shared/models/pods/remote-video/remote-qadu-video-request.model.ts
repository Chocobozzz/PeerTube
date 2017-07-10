export interface RemoteQaduVideoData {
  remoteId: string
  views?: number
  likes?: number
  dislikes?: number
}

export interface RemoteQaduVideoRequest {
  data: RemoteQaduVideoData
}
