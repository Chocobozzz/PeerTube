import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoAuthorRemoveData {
  uuid: string
}

export interface RemoteVideoAuthorRemoveRequest extends RemoteVideoRequest {
  type: 'remove-author'
  data: RemoteVideoAuthorRemoveData
}
