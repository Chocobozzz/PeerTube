import {
  UserRight,
  VideoImportPayload,
  VideoImportState,
  VideoImportTorrentPayload,
  VideoImportYoutubeDLPayload
} from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MUser } from '@server/types/models/index.js'
import { MVideoImport } from '@server/types/models/video/video-import.js'

export async function buildRetryImportJob (videoImport: MVideoImport, options: { ignoreMaxAttempts?: boolean } = {}) {
  let type: VideoImportPayload['type']

  if (videoImport.magnetUri) type = 'magnet-uri'
  else if (videoImport.torrentName) type = 'torrent-file'
  else type = 'youtube-dl'

  const payload: VideoImportPayload = {
    type: videoImport.payload?.type ?? type,
    videoImportId: videoImport.id,

    // If part of a sync process, there is a parent job that will aggregate children results
    preventException: videoImport.payload?.preventException ?? !!videoImport.videoChannelSyncId,
    fromChannelImport: isFromChannelImport(videoImport),
    ignoreMaxAttempts: options.ignoreMaxAttempts === true,

    generateTranscription: videoImport.payload?.generateTranscription ?? CONFIG.VIDEO_TRANSCRIPTION.ENABLED,
    fileExt: (videoImport.payload as VideoImportYoutubeDLPayload)?.fileExt,
    torrentPath: (videoImport.payload as VideoImportTorrentPayload)?.torrentPath,
    torrentStagingKey: (videoImport.payload as VideoImportTorrentPayload)?.torrentStagingKey
  }

  videoImport.state = VideoImportState.PENDING
  await videoImport.save()

  return { type: 'video-import' as const, payload }
}

export function isFromChannelImport (videoImport: MVideoImport) {
  // videoChannelSyncId is set to null if the sync is deleted, so also check the payload
  return videoImport.payload?.fromChannelImport ?? !!videoImport.videoChannelSyncId
}

export function canIgnoreImportMaxAttempts (user: Pick<MUser, 'hasRight'>) {
  return user.hasRight(UserRight.MANAGE_VIDEO_IMPORTS) === true
}
