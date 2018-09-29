import { join } from 'path'
import { remove, readdir, move } from 'fs-extra'
import { CONFIG } from '../server/initializers/constants'
import { getVideoFileResolution, transcode, getVideoFileBitrate } from '../server/helpers/ffmpeg-utils'
import { getMaxBitrate } from '../shared/models/videos'
import { VideoRedundancyModel } from '../server/models/redundancy/video-redundancy'

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
    if (uuid != null && isLocalVideo && isMaxBitrateExceeded) {
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
    }
  }
  console.log('Finished optimizing videos')
}

// TODO: copied from prune-storage.ts, should be moved to some common file
function getUUIDFromFilename (filename: string) {
  const regex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
  const result = filename.match(regex)

  if (!result || Array.isArray(result) === false) return null

  return result[0]
}
