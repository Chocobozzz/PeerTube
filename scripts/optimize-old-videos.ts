import { VIDEO_TRANSCODING_FPS } from '../server/initializers/constants'
import { getDurationFromVideoFile, getVideoFileBitrate, getVideoFileFPS, getVideoFileResolution } from '../server/helpers/ffmpeg-utils'
import { getMaxBitrate } from '../shared/models/videos'
import { VideoModel } from '../server/models/video/video'
import { optimizeVideofile } from '../server/lib/video-transcoding'
import { initDatabaseModels } from '../server/initializers'
import { basename, dirname, join } from 'path'
import { copy, move, remove } from 'fs-extra'
import { CONFIG } from '../server/initializers/config'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

let currentVideoId = null
let currentFile = null

process.on('SIGINT', async function () {
  console.log('Cleaning up temp files')
  await remove(`${currentFile}_backup`)
  await remove(`${dirname(currentFile)}/${currentVideoId}-transcoded.mp4`)
  process.exit(0)
})

async function run () {
  await initDatabaseModels(true)

  const localVideos = await VideoModel.listLocal()

  for (const video of localVideos) {
    currentVideoId = video.id

    for (const file of video.VideoFiles) {
      currentFile = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(file))

      const [ videoBitrate, fps, resolution ] = await Promise.all([
        getVideoFileBitrate(currentFile),
        getVideoFileFPS(currentFile),
        getVideoFileResolution(currentFile)
      ])

      const maxBitrate = getMaxBitrate(resolution.videoFileResolution, fps, VIDEO_TRANSCODING_FPS)
      const isMaxBitrateExceeded = videoBitrate > maxBitrate
      if (isMaxBitrateExceeded) {
        console.log(
          'Optimizing video file %s with bitrate %s kbps (max: %s kbps)',
          basename(currentFile), videoBitrate / 1000, maxBitrate / 1000
        )

        const backupFile = `${currentFile}_backup`
        await copy(currentFile, backupFile)

        await optimizeVideofile(video, file)

        const originalDuration = await getDurationFromVideoFile(backupFile)
        const newDuration = await getDurationFromVideoFile(currentFile)

        if (originalDuration === newDuration) {
          console.log('Finished optimizing %s', basename(currentFile))
          await remove(backupFile)
          continue
        }

        console.log('Failed to optimize %s, restoring original', basename(currentFile))
        await move(backupFile, currentFile, { overwrite: true })
        await video.createTorrentAndSetInfoHash(file)
        await file.save()
      }
    }
  }

  console.log('Finished optimizing videos')
}
