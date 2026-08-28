import { VideoFileStream, VideoLifecycleDeleteResolutionsAction } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { scheduleVideoFederation } from '@server/lib/activitypub/videos/index.js'
import { updateM3U8AndShaPlaylist } from '@server/lib/hls.js'
import { removeHLSFile, removeWebVideoFile } from '@server/lib/video-file.js'
import { MVideoFile, MVideoFull } from '@server/types/models/index.js'
import { LifecycleActionHandler } from './action.model.js'

const logger = createLogger('video-files-lifecycle')

export const deleteResolutionsAction: LifecycleActionHandler<VideoLifecycleDeleteResolutionsAction> = {
  validate (action) {
    if (action.keep !== 'max') {
      throw new Error(`"keep" of "delete-resolutions" action must be "max" instead of ${action.keep}`)
    }
  },

  describe () {
    return 'delete every resolution below the max resolution'
  },

  buildWhereForUnprocessed () {
    // Only select videos that have at least one group of files (Web Videos or a HLS playlist) with multiple resolutions
    // Both groups are checked in their own subquery so PostgreSQL can use the "videoId" and "videoStreamingPlaylistId" indexes
    const webVideoSQL = `EXISTS (` +
      `  SELECT 1 FROM "videoFile" ` +
      `  WHERE "videoFile"."videoId" = "video"."id" ` +
      `    AND ("videoFile"."streams" & :lifecycleVideoStream) != 0 ` +
      `  GROUP BY "videoFile"."videoId" ` +
      `    HAVING COUNT(DISTINCT "videoFile"."resolution") > 1` +
      `)`

    const hlsSQL = `EXISTS (` +
      `  SELECT 1 FROM "videoFile" ` +
      `  INNER JOIN "videoStreamingPlaylist" ` +
      `    ON "videoStreamingPlaylist"."id" = "videoFile"."videoStreamingPlaylistId" ` +
      `  WHERE "videoStreamingPlaylist"."videoId" = "video"."id" ` +
      `    AND ("videoFile"."streams" & :lifecycleVideoStream) != 0 ` +
      `  GROUP BY "videoFile"."videoStreamingPlaylistId" ` +
      `    HAVING COUNT(DISTINCT "videoFile"."resolution") > 1` +
      `)`

    return {
      sql: `${webVideoSQL} OR ${hlsSQL}`,
      replacements: { lifecycleVideoStream: VideoFileStream.VIDEO }
    }
  },

  simulate (video) {
    const toDelete = listFilesToDelete(video)

    return buildResult(toDelete)
  },

  async apply (video) {
    const { webVideoFiles, hlsFiles } = listFilesToDeleteByGroup(video)

    const deleted: MVideoFile[] = []

    for (const file of webVideoFiles) {
      logger.info(`Deleting Web Video file ${file.id} (${file.resolution}p) of video ${video.uuid} in files lifecycle.`)

      await removeWebVideoFile(video, file.id)
      deleted.push(file)
    }

    if (hlsFiles.length !== 0) {
      let playlist = video.getHLSPlaylist()

      for (const file of hlsFiles) {
        logger.info(`Deleting HLS file ${file.id} (${file.resolution}p) of video ${video.uuid} in files lifecycle.`)

        playlist = await removeHLSFile(video, file.id)
        deleted.push(file)

        // The whole playlist has been removed, there is nothing left to delete or to update
        if (!playlist) break
      }

      if (playlist) await updateM3U8AndShaPlaylist(video, playlist)
    }

    if (deleted.length !== 0) scheduleVideoFederation({ video })

    return buildResult(deleted)
  }
}

// ---------------------------------------------------------------------------

function listFilesToDeleteByGroup (video: MVideoFull) {
  return {
    webVideoFiles: listGroupFilesToDelete(video.VideoFiles),
    hlsFiles: listGroupFilesToDelete(video.getHLSPlaylist()?.VideoFiles)
  }
}

function listFilesToDelete (video: MVideoFull) {
  const { webVideoFiles, hlsFiles } = listFilesToDeleteByGroup(video)

  return webVideoFiles.concat(hlsFiles)
}

// Files of a group are the Web Video files of a video, or the files of one of its streaming playlists
function listGroupFilesToDelete (files: MVideoFile[]) {
  if (!files || files.length === 0) return []

  // Files that only contain an audio stream are never deleted:
  //  * it can be the separated audio track of a HLS playlist, needed by all its video resolutions
  //  * it can be the audio only Web Video file, used by podcast feeds
  const videoStreamFiles = files.filter(f => (f.streams & VideoFileStream.VIDEO) !== 0)

  // Audio only video: we would delete all its files
  if (videoStreamFiles.length === 0) return []

  const maxResolution = Math.max(...videoStreamFiles.map(f => f.resolution))

  return videoStreamFiles.filter(f => f.resolution < maxResolution)
}

function buildResult (files: MVideoFile[]) {
  return { files: files.length }
}
