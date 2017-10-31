import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoCreateData {
  uuid: string
  channelUUID: string
  tags: string[]
  name: string
  category: number
  licence: number
  language: number
  nsfw: boolean
  truncatedDescription: string
  duration: number
  createdAt: Date
  updatedAt: Date
  views: number
  likes: number
  dislikes: number
  privacy: number
  thumbnailData: string
  files: {
    infoHash: string
    extname: string
    resolution: number
    size: number
  }[]
}

export interface RemoteVideoCreateRequest extends RemoteVideoRequest {
  type: 'add-video'
  data: RemoteVideoCreateData
}
