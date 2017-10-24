import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoChannelRemoveData {
  uuid: string
}

export interface RemoteVideoChannelRemoveRequest extends RemoteVideoRequest {
  type: 'remove-channel'
  data: RemoteVideoChannelRemoveData
}
