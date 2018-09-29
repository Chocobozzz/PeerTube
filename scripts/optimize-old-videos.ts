import { join, basename, extname } from 'path'
import { remove, readdir, move, stat } from 'fs-extra'
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
    const { videoFileResolution, isPortraitMode } = await getVideoFileResolution(inputPath)
    const uuid = getUUIDFromFilename(file)

    const isLocalVideo = await VideoRedundancyModel.isLocalByVideoUUIDExists(uuid)
    const isMaxBitrateExceeded = videoBitrate > getMaxBitrate(videoFileResolution)
    if (uuid && isLocalVideo && isMaxBitrateExceeded) {
      await optimizeVideo(uuid, inputPath, videoFileResolution, isPortraitMode)
    }
  }
  console.log('Finished optimizing videos')
}

async function optimizeVideo (uuid: string, inputPath: string, resolution: number, isPortraitMode: boolean) {
  const ext = extname(inputPath)
  console.log(`Optimizing video ${ basename(inputPath) }`)
  const outputPath = join(CONFIG.STORAGE.VIDEOS_DIR, `${uuid}-${resolution}-optimized${ext}`)
  await remove(outputPath)
  const transcodeOptions = {
    inputPath: inputPath,
    outputPath: outputPath,
    resolution: resolution,
    isPortraitMode: isPortraitMode
  }
  await transcode(transcodeOptions)
  await move(outputPath, inputPath, { overwrite: true })
  const videoModel = await VideoModel.loadByUUIDWithFile(uuid)
  const videoFile = videoModel.VideoFiles.find(f => f.resolution === resolution)
  videoModel.createTorrentAndSetInfoHash(videoFile)
  stat(inputPath, (err, stats) => {
    if (err) throw err
    videoFile.size = stats.size
  })
}
