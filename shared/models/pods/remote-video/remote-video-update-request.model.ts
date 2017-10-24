import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoUpdateData {
  uuid: string
  tags: string[]
  name: string
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

export interface RemoteVideoUpdateRequest extends RemoteVideoRequest {
  type: 'update-video'
  data: RemoteVideoUpdateData
}
