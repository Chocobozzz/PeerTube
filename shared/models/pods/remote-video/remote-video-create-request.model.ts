import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoCreateData {
  remoteId: string
  author: string
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
  thumbnailData: string
}

export interface RemoteVideoCreateRequest extends RemoteVideoRequest {
  type: 'add'
  data: RemoteVideoCreateData
}
