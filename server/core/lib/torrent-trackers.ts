import { ManageVideoTorrentPayload } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { JOB_PRIORITY } from '@server/initializers/constants.js'
import { ApplicationModel } from '@server/models/application/application.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { JobQueue } from './job-queue/job-queue.js'

const logger = createLogger()

export async function updateTorrentsTrackersIfNeeded () {
  if (!await ApplicationModel.trackerUrlsChanged()) return

  logger.info('Tracker URLs changed: creating jobs to update the announce list of local torrent files.')

  const batchSize = 1000
  let lastId = 0
  let total = 0

  while (true) {
    const files = await VideoFileModel.listOwnedWithTorrentBatch({ lastId, batchSize })
    if (files.length === 0) break

    for (const file of files) {
      const payload: ManageVideoTorrentPayload = file.videoStreamingPlaylistId
        ? { action: 'update-metadata', streamingPlaylistId: file.videoStreamingPlaylistId, videoFileId: file.id }
        : { action: 'update-metadata', videoId: file.videoId, videoFileId: file.id }

      await JobQueue.Instance.createJob({
        type: 'manage-video-torrent',
        payload,
        priority: JOB_PRIORITY.TORRENT_TRACKERS_UPDATE,
        deduplicationId: `update-torrent-trackers-${file.id}`
      })
    }

    total += files.length
    lastId = files[files.length - 1].id
  }

  logger.info(`Created ${total} jobs to update the announce list of local torrent files.`)
}
