import { VideoImportPayload, VideoImportState, VideoImportYoutubeDLPayload } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MVideoImport } from '@server/types/models/video/video-import.js'
import { JobQueue } from './job-queue/job-queue.js'

export async function retryImport (videoImport: MVideoImport) {
  let type: VideoImportPayload['type']

  if (videoImport.magnetUri) type = 'magnet-uri'
  else if (videoImport.torrentName) type = 'torrent-file'
  else type = 'youtube-dl'

  const payload: VideoImportPayload = {
    type: videoImport.payload?.type ?? type,
    videoImportId: videoImport.id,

    // If part of a sync process, there is a parent job that will aggregate children results
    preventException: videoImport.payload?.preventException ?? !!videoImport.videoChannelSyncId,

    generateTranscription: videoImport.payload?.generateTranscription ?? CONFIG.VIDEO_TRANSCRIPTION.ENABLED,
    fileExt: (videoImport.payload as VideoImportYoutubeDLPayload)?.fileExt
  }

  await JobQueue.Instance.createJob({ type: 'video-import', payload })

  videoImport.state = VideoImportState.PENDING
  await videoImport.save()
}
