export interface RemoteVideoRequest {
  type: 'add' | 'update' | 'remove' | 'report-abuse'
  data: any
}
