import { ProcessRole } from './process-role.type.js'

export interface Debug {
  ip: string
  activityPubMessagesWaiting: number

  secondariesUp: number
  processes: DebugProcess[]
}

export interface DebugProcess {
  id: string
  role: ProcessRole
  hostname: string
  pid: number
  version: string

  startedAt: string
  lastSeenAt: string
}

export type SendDebugCommand = {
  command:
    | 'remove-dandling-resumable-uploads'
    | 'process-video-stats-buffer'
    | 'process-video-viewers'
    | 'process-video-channel-sync-latest'
    | 'process-update-videos-scheduler'
    | 'remove-expired-user-exports'
    | 'process-remove-old-stats'
    | 'process-video-files-lifecycle'
} | SendDebugTestEmails

export type SendDebugTestEmails = {
  command: 'test-emails'
  email: string
}
