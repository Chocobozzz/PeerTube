import { CONFIG, VIDEO_TRANSCODING_FPS } from '../server/initializers/constants'
import { getVideoFileBitrate, getVideoFileFPS, getVideoFileResolution, getDurationFromVideoFile } from '../server/helpers/ffmpeg-utils'
import { getMaxBitrate } from '../shared/models/videos'
import { VideoModel } from '../server/models/video/video'
import { optimizeVideofile } from '../server/lib/video-transcoding'
import { initDatabaseModels } from '../server/initializers'
import { join, basename } from 'path'
import { copy, remove, move } from 'fs-extra'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  const localVideos = await VideoModel.listLocal()

  for (const video of localVideos) {
    for (const file of video.VideoFiles) {
      const inputPath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(file))

      const [ videoBitrate, fps, resolution ] = await Promise.all([
        getVideoFileBitrate(inputPath),
        getVideoFileFPS(inputPath),
        getVideoFileResolution(inputPath)
      ])

      const maxBitrate = getMaxBitrate(resolution.videoFileResolution, fps, VIDEO_TRANSCODING_FPS)
      const isMaxBitrateExceeded = videoBitrate > maxBitrate
      if (isMaxBitrateExceeded) {
        console.log('Optimizing video file %s with bitrate %s kbps (max: %s kbps)',
          basename(inputPath), videoBitrate / 1000, maxBitrate / 1000)
        const backupFile = inputPath + '_backup'
        await copy(inputPath, backupFile)
        await optimizeVideofile(video, file)
        const originalDuration = await getDurationFromVideoFile(backupFile)
        const newDuration = await getDurationFromVideoFile(inputPath)
        if (originalDuration === newDuration) {
          console.log('Finished optimizing %s', basename(inputPath))
          remove(backupFile)
        } else {
          console.log('Failed to optimize %s, restoring original', inputPath)
          move(backupFile, inputPath, { overwrite: true })
        }
      }
    }
  }

  console.log('Finished optimizing videos')
}
