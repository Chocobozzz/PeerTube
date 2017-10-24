export interface RemoteVideoRequest {
  type: RemoteVideoRequestType
  data: any
}

export type RemoteVideoRequestType = 'add-video' | 'update-video' | 'remove-video' |
                                     'add-channel' | 'update-channel' | 'remove-channel' |
                                     'report-abuse' |
                                     'add-author' | 'remove-author'
