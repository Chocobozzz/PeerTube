import { join } from 'path'
import { readdir } from 'fs-extra'
import { CONFIG } from '../server/initializers/constants'
import { getVideoFileResolution, getVideoFileBitrate, getVideoFileFPS } from '../server/helpers/ffmpeg-utils'
import { getMaxBitrate } from '../shared/models/videos'
import { VideoRedundancyModel } from '../server/models/redundancy/video-redundancy'
import { VideoModel } from '../server/models/video/video'
import { getUUIDFromFilename } from '../server/helpers/utils'
import { optimizeVideofile } from '../server/lib/video-transcoding'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  const files = await readdir(CONFIG.STORAGE.VIDEOS_DIR)
  for (const file of files) {
    const inputPath = join(CONFIG.STORAGE.VIDEOS_DIR, file)
    const videoBitrate = await getVideoFileBitrate(inputPath)
    const fps = await getVideoFileFPS(inputPath)
    const resolution = await getVideoFileResolution(inputPath)
    const uuid = getUUIDFromFilename(file)

    const isLocalVideo = await VideoRedundancyModel.isLocalByVideoUUIDExists(uuid)
    const isMaxBitrateExceeded = videoBitrate > getMaxBitrate(resolution.videoFileResolution, fps)
    if (uuid && isLocalVideo && isMaxBitrateExceeded) {
      const videoModel = await VideoModel.loadByUUIDWithFile(uuid)
      await optimizeVideofile(videoModel, inputPath)
    }
  }
  console.log('Finished optimizing videos')
}
