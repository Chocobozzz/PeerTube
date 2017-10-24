import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoChannelCreateData {
  uuid: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
  ownerUUID: string
}

export interface RemoteVideoChannelCreateRequest extends RemoteVideoRequest {
  type: 'add-channel'
  data: RemoteVideoChannelCreateData
}
