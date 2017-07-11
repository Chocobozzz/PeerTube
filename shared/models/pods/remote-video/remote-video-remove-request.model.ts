import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoRemoveData {
  uuid: string
}

export interface RemoteVideoRemoveRequest extends RemoteVideoRequest {
  type: 'remove'
  data: RemoteVideoRemoveData
}
