import { VIDEO_TRANSCODING_FPS } from '../server/initializers/constants'
import { getVideoFileBitrate, getVideoFileFPS, getVideoFileResolution } from '../server/helpers/ffmpeg-utils'
import { getMaxBitrate } from '../shared/models/videos'
import { VideoModel } from '../server/models/video/video'
import { optimizeVideofile } from '../server/lib/video-transcoding'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  const localVideos = await VideoModel.listLocal()

  for (const video of localVideos) {
    for (const file of video.VideoFiles) {
      const inputPath = video.getVideoFilename(file)

      const [ videoBitrate, fps, resolution ] = await Promise.all([
        getVideoFileBitrate(inputPath),
        getVideoFileFPS(inputPath),
        getVideoFileResolution(inputPath)
      ])

      const isMaxBitrateExceeded = videoBitrate > getMaxBitrate(resolution.videoFileResolution, fps, VIDEO_TRANSCODING_FPS)
      if (isMaxBitrateExceeded) {
        await optimizeVideofile(video, file)
      }
    }
  }

  console.log('Finished optimizing videos')
}
