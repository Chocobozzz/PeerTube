import { copy, move, remove } from 'fs-extra'
import { basename, dirname } from 'path'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { processMoveToObjectStorage } from '@server/lib/job-queue/handlers/move-to-object-storage'
import { getVideoFilePath, getVideoFilePathMakeAvailable } from '@server/lib/video-paths'
import { getMaxBitrate } from '@shared/core-utils'
import { MoveObjectStoragePayload } from '@shared/models'
import { getDurationFromVideoFile, getVideoFileBitrate, getVideoFileFPS, getVideoFileResolution } from '../server/helpers/ffprobe-utils'
import { registerTSPaths } from '../server/helpers/register-ts-paths'
import { initDatabaseModels } from '../server/initializers/database'
import { optimizeOriginalVideofile } from '../server/lib/transcoding/video-transcoding'
import { VideoModel } from '../server/models/video/video'

registerTSPaths()

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

let currentVideoId: string
let currentFilePath: string

process.on('SIGINT', async function () {
  console.log('Cleaning up temp files')
  await remove(`${currentFilePath}_backup`)
  await remove(`${dirname(currentFilePath)}/${currentVideoId}-transcoded.mp4`)
  process.exit(0)
})

async function run () {
  await initDatabaseModels(true)

  const localVideos = await VideoModel.listLocal()

  for (const localVideo of localVideos) {
    const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(localVideo.id)

    currentVideoId = video.id

    for (const file of video.VideoFiles) {
      currentFilePath = await getVideoFilePathMakeAvailable(video, file)

      const [ videoBitrate, fps, dataResolution ] = await Promise.all([
        getVideoFileBitrate(currentFilePath),
        getVideoFileFPS(currentFilePath),
        getVideoFileResolution(currentFilePath)
      ])

      const maxBitrate = getMaxBitrate({ ...dataResolution, fps })
      const isMaxBitrateExceeded = videoBitrate > maxBitrate
      if (isMaxBitrateExceeded) {
        console.log(
          'Optimizing video file %s with bitrate %s kbps (max: %s kbps)',
          basename(currentFilePath), videoBitrate / 1000, maxBitrate / 1000
        )

        const backupFile = `${currentFilePath}_backup`
        await copy(currentFilePath, backupFile)

        await optimizeOriginalVideofile(video, file)
        // Update file path, the video filename changed
        currentFilePath = getVideoFilePath(video, file)

        const originalDuration = await getDurationFromVideoFile(backupFile)
        const newDuration = await getDurationFromVideoFile(currentFilePath)

        if (originalDuration === newDuration) {
          console.log('Finished optimizing %s', basename(currentFilePath))
          await remove(backupFile)
          continue
        }

        console.log('Failed to optimize %s, restoring original', basename(currentFilePath))
        await move(backupFile, currentFilePath, { overwrite: true })
        await createTorrentAndSetInfoHash(video, file)
        await file.save()
      }
    }

    if (CONFIG.OBJECT_STORAGE.ENABLED === true) {
      await processMoveToObjectStorage({ data: { videoUUID: video.uuid } as MoveObjectStoragePayload } as any)
    }
  }

  console.log('Finished optimizing videos')
}
