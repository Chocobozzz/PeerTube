import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoChannelUpdateData {
  uuid: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
  ownerUUID: string
}

export interface RemoteVideoChannelUpdateRequest extends RemoteVideoRequest {
  type: 'update-channel'
  data: RemoteVideoChannelUpdateData
}
