export interface Debug {
  ip: string
  activityPubMessagesWaiting: number
}

export interface SendDebugCommand {
  command: 'remove-dandling-resumable-uploads'
}
