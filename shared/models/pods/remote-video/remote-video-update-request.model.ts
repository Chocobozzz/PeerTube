export interface RemoteVideoUpdateData {
  uuid: string
  tags: string[]
  name: string
  extname: string
  infoHash: string
  category: number
  licence: number
  language: number
  nsfw: boolean
  description: string
  duration: number
  createdAt: Date
  updatedAt: Date
  views: number
  likes: number
  dislikes: number
  files: {
    infoHash: string
    extname: string
    resolution: number
    size: number
  }[]
}

export interface RemoteVideoUpdateRequest {
  type: 'update'
  data: RemoteVideoUpdateData
}
