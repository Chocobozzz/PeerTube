export interface Debug {
  ip: string
  activityPubMessagesWaiting: number
}

export interface SendDebugCommand {
  command: 'remove-dandling-resumable-uploads'
  | 'process-video-views-buffer'
  | 'process-video-viewers'
  | 'process-video-channel-sync-latest'
  | 'process-update-videos-scheduler'
  | 'remove-expired-user-exports'
}
