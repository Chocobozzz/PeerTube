import { RemoteVideoRequest } from './remote-video-request.model'

export interface RemoteVideoReportAbuseData {
  videoRemoteId: string
  reporterUsername: string
  reportReason: string
}

export interface RemoteVideoReportAbuseRequest extends RemoteVideoRequest {
  type: 'report-abuse'
  data: RemoteVideoReportAbuseData
}
