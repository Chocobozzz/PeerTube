export interface Debug {
  ip: string
  activityPubMessagesWaiting: number

  // Are all the local files of each kind in object storage?
  // Secondary processes that don't share the storage directories of the primary can manage files only if they are
  sharedFiles: {
    // Keyed by object storage section (thumbnails, web_videos...)
    sections: {
      [section: string]: {
        inObjectStorage: boolean

        // Why they are not
        reasons: string[]
      }
    }
  }
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
