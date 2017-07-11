export interface RemoteQaduVideoData {
  uuid: string
  views?: number
  likes?: number
  dislikes?: number
}

export interface RemoteQaduVideoRequest {
  data: RemoteQaduVideoData
}
