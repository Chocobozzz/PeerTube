import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import { program } from 'commander'
import { VideoModel } from '../server/models/video/video'
import { initDatabaseModels } from '../server/initializers/database'
import { JobQueue } from '../server/lib/job-queue'
import { computeResolutionsToTranscode } from '@server/helpers/ffprobe-utils'
import { VideoTranscodingPayload } from '@shared/models'
import { CONFIG } from '@server/initializers/config'
import { isUUIDValid } from '@server/helpers/custom-validators/misc'

program
  .option('-v, --video [videoUUID]', 'Video UUID')
  .option('-r, --resolution [resolution]', 'Video resolution (integer)')
  .option('--generate-hls', 'Generate HLS playlist')
  .parse(process.argv)

const options = program.opts()

if (options.video === undefined) {
  console.error('All parameters are mandatory.')
  process.exit(-1)
}

if (options.resolution !== undefined && Number.isNaN(+options.resolution)) {
  console.error('The resolution must be an integer (example: 1080).')
  process.exit(-1)
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  if (isUUIDValid(options.video) === false) {
    console.error('%s is not a valid video UUID.', options.video)
    return
  }

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(options.video)
  if (!video) throw new Error('Video not found.')

  const dataInput: VideoTranscodingPayload[] = []
  const { videoFileResolution } = await video.getMaxQualityResolution()

  // Generate HLS files
  if (options.generateHls || CONFIG.TRANSCODING.WEBTORRENT.ENABLED === false) {
    const resolutionsEnabled = options.resolution
      ? [ options.resolution ]
      : computeResolutionsToTranscode(videoFileResolution, 'vod').concat([ videoFileResolution ])

    for (const resolution of resolutionsEnabled) {
      dataInput.push({
        type: 'new-resolution-to-hls',
        videoUUID: video.uuid,
        resolution,
        isPortraitMode: false,
        copyCodecs: false,
        isMaxQuality: false
      })
    }
  } else {
    if (options.resolution !== undefined) {
      dataInput.push({
        type: 'new-resolution-to-webtorrent',
        videoUUID: video.uuid,
        isNewVideo: false,
        resolution: options.resolution
      })
    } else {
      if (video.VideoFiles.length === 0) {
        console.error('Cannot regenerate webtorrent files with a HLS only video.')
        return
      }

      dataInput.push({
        type: 'optimize-to-webtorrent',
        videoUUID: video.uuid,
        isNewVideo: false
      })
    }
  }

  await JobQueue.Instance.init()

  for (const d of dataInput) {
    await JobQueue.Instance.createJobWithPromise({ type: 'video-transcoding', payload: d })
    console.log('Transcoding job for video %s created.', video.uuid)
  }
}
