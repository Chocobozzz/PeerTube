import { program } from 'commander'
import { isUUIDValid, toCompleteUUID } from '@server/helpers/custom-validators/misc'
import { computeResolutionsToTranscode } from '@server/helpers/ffmpeg'
import { CONFIG } from '@server/initializers/config'
import { buildTranscodingJob } from '@server/lib/video'
import { VideoState, VideoTranscodingPayload } from '@shared/models'
import { initDatabaseModels } from '../server/initializers/database'
import { JobQueue } from '../server/lib/job-queue'
import { VideoModel } from '../server/models/video/video'

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

  const uuid = toCompleteUUID(options.video)

  if (isUUIDValid(uuid) === false) {
    console.error('%s is not a valid video UUID.', options.video)
    return
  }

  const video = await VideoModel.loadFull(uuid)
  if (!video) throw new Error('Video not found.')

  const dataInput: VideoTranscodingPayload[] = []
  const maxResolution = video.getMaxQualityFile().resolution

  // FIXME: check the file has audio
  const hasAudio = true

  // Generate HLS files
  if (options.generateHls || CONFIG.TRANSCODING.WEBTORRENT.ENABLED === false) {
    const resolutionsEnabled = options.resolution
      ? [ parseInt(options.resolution) ]
      : computeResolutionsToTranscode({ input: maxResolution, type: 'vod', includeInput: true, strictLower: false, hasAudio })

    for (const resolution of resolutionsEnabled) {
      dataInput.push({
        type: 'new-resolution-to-hls' as 'new-resolution-to-hls',
        videoUUID: video.uuid,
        resolution,

        hasAudio,

        copyCodecs: false,
        isNewVideo: false,
        isMaxQuality: maxResolution === resolution,
        autoDeleteWebTorrentIfNeeded: false
      })
    }
  } else {
    if (options.resolution !== undefined) {
      dataInput.push({
        type: 'new-resolution-to-webtorrent' as 'new-resolution-to-webtorrent',
        videoUUID: video.uuid,

        createHLSIfNeeded: true,

        hasAudio,

        isNewVideo: false,
        resolution: parseInt(options.resolution)
      })
    } else {
      if (video.VideoFiles.length === 0) {
        console.error('Cannot regenerate webtorrent files with a HLS only video.')
        return
      }

      dataInput.push({
        type: 'optimize-to-webtorrent' as 'optimize-to-webtorrent',
        videoUUID: video.uuid,
        isNewVideo: false
      })
    }
  }

  JobQueue.Instance.init()

  video.state = VideoState.TO_TRANSCODE
  await video.save()

  for (const d of dataInput) {
    await JobQueue.Instance.createJob(await buildTranscodingJob(d))

    console.log('Transcoding job for video %s created.', video.uuid)
  }
}
