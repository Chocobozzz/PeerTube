import { join } from 'path'
import { remove, readdir, move } from 'fs-extra'
import { CONFIG } from '../server/initializers/constants'
import { getVideoFileResolution, transcode, getVideoFileBitrate } from '../server/helpers/ffmpeg-utils'
import { getMaxBitrate } from '../shared/models/videos'
import { VideoRedundancyModel } from '../server/models/redundancy/video-redundancy'
import { VideoModel } from '../server/models/video/video'
import { getUUIDFromFilename } from '../server/helpers/utils'

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
    const resolution = await getVideoFileResolution(inputPath)
    const uuid = getUUIDFromFilename(file)

    const isLocalVideo = await VideoRedundancyModel.isLocalByVideoUUIDExists(uuid)
    const isMaxBitrateExceeded = videoBitrate > getMaxBitrate(resolution.videoFileResolution)
    if (uuid && isLocalVideo && isMaxBitrateExceeded) {
      console.log(`Optimizing video ${ file }`)
      const outputPath = join(CONFIG.STORAGE.VIDEOS_DIR, uuid + '-optimized.mp4')
      await remove(outputPath)
      const transcodeOptions = {
        inputPath: inputPath,
        outputPath: outputPath,
        resolution: resolution.videoFileResolution,
        isPortraitMode: resolution.isPortraitMode
      }

      await transcode(transcodeOptions)
      await move(outputPath, inputPath, { overwrite: true })
      const videoModel = VideoModel.loadByUUIDWithFile(uuid)
      //videoModel.createTorrentAndSetInfoHash()
    }
  }
  console.log('Finished optimizing videos')
}
