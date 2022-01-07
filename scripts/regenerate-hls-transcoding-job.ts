import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import { program } from 'commander'
import { VideoModel } from '../server/models/video/video'
import { initDatabaseModels } from '../server/initializers/database'
import { JobQueue } from '../server/lib/job-queue'
import { computeResolutionsToTranscode } from '@server/helpers/ffprobe-utils'
import { VideoState, VideoTranscodingPayload } from '@shared/models'
import { CONFIG } from '@server/initializers/config'
import { isUUIDValid, toCompleteUUID } from '@server/helpers/custom-validators/misc'
import { addTranscodingJob } from '@server/lib/video'
import { map } from 'bluebird'

program
  .description('Regenerate HLS transcoding jobs')
  .parse(process.argv)

run()
  .then(() => process.exit(0))
  .catch(err => console.error(err))

async function run () {
  await initDatabaseModels(true)

  const videos = await VideoModel.listLocal()

  await map(videos, v => {
    return createTranscodingJob(v.uuid)
      .catch(err => console.error('Cannot create transcoding job for video %s.', v.url, err))
  }, { concurrency: 1 })
}

async function createTranscodingJob (uuid: string) {
  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(uuid)
  if (!video) throw new Error('Video not found.')

  const dataInput: VideoTranscodingPayload[] = []
  const resolution = video.getMaxQualityFile().resolution

  const resolutionsEnabled = computeResolutionsToTranscode(resolution, 'vod').concat([ resolution ])

  for (const resolution of resolutionsEnabled) {
    dataInput.push({
      type: 'new-resolution-to-hls',
      videoUUID: video.uuid,
      resolution,
      isPortraitMode: false,
      copyCodecs: false,
      isNewVideo: false,
      isMaxQuality: false
    })
  }

  JobQueue.Instance.init()

  video.state = VideoState.TO_TRANSCODE
  await video.save()

  for (const d of dataInput) {
    await addTranscodingJob(d, {})
    console.log('Transcoding job for video %s created.', video.uuid)
  }
}
