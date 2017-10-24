import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoAuthorCreateData {
  uuid: string
  name: string
}

export interface RemoteVideoAuthorCreateRequest extends RemoteVideoRequest {
  type: 'add-author'
  data: RemoteVideoAuthorCreateData
}
