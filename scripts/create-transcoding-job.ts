import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { VideoModel } from '../server/models/video/video'
import { initDatabaseModels } from '../server/initializers'
import { JobQueue } from '../server/lib/job-queue'
import { VideoTranscodingPayload } from '../server/lib/job-queue/handlers/video-transcoding'
import { computeResolutionsToTranscode } from '@server/helpers/ffmpeg-utils'

program
  .option('-v, --video [videoUUID]', 'Video UUID')
  .option('-r, --resolution [resolution]', 'Video resolution (integer)')
  .option('--generate-hls', 'Generate HLS playlist')
  .parse(process.argv)

if (program['video'] === undefined) {
  console.error('All parameters are mandatory.')
  process.exit(-1)
}

if (program.resolution !== undefined && Number.isNaN(+program.resolution)) {
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

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(program['video'])
  if (!video) throw new Error('Video not found.')

  const dataInput: VideoTranscodingPayload[] = []
  const { videoFileResolution } = await video.getMaxQualityResolution()

  if (program.generateHls) {
    const resolutionsEnabled = program.resolution
      ? [ program.resolution ]
      : computeResolutionsToTranscode(videoFileResolution).concat([ videoFileResolution ])

    for (const resolution of resolutionsEnabled) {
      dataInput.push({
        type: 'hls',
        videoUUID: video.uuid,
        resolution,
        isPortraitMode: false,
        copyCodecs: false
      })
    }
  } else if (program.resolution !== undefined) {
    dataInput.push({
      type: 'new-resolution' as 'new-resolution',
      videoUUID: video.uuid,
      isNewVideo: false,
      resolution: program.resolution
    })
  } else {
    dataInput.push({
      type: 'optimize' as 'optimize',
      videoUUID: video.uuid,
      isNewVideo: false
    })
  }

  await JobQueue.Instance.init()

  for (const d of dataInput) {
    await JobQueue.Instance.createJobWithPromise({ type: 'video-transcoding', payload: d })
    console.log('Transcoding job for video %s created.', video.uuid)
  }
}
