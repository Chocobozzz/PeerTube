import { program } from 'commander'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc'
import { CONFIG } from '@server/initializers/config'
import { initDatabaseModels } from '@server/initializers/database'
import { JobQueue } from '@server/lib/job-queue'
import { moveToExternalStorageState } from '@server/lib/video-state'
import { VideoModel } from '@server/models/video/video'
import { VideoState, VideoStorage } from '@shared/models'

program
  .description('Move videos to another storage.')
  .option('-o, --to-object-storage', 'Move videos in object storage')
  .option('-v, --video [videoUUID]', 'Move a specific video')
  .option('-a, --all-videos', 'Migrate all videos')
  .parse(process.argv)

const options = program.opts()

if (!options['toObjectStorage']) {
  console.error('You need to choose where to send video files.')
  process.exit(-1)
}

if (!options['video'] && !options['allVideos']) {
  console.error('You need to choose which videos to move.')
  process.exit(-1)
}

if (options['toObjectStorage'] && !CONFIG.OBJECT_STORAGE.ENABLED) {
  console.error('Object storage is not enabled on this instance.')
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

  JobQueue.Instance.init()

  let ids: number[] = []

  if (options['video']) {
    const video = await VideoModel.load(toCompleteUUID(options['video']))

    if (!video) {
      console.error('Unknown video ' + options['video'])
      process.exit(-1)
    }

    if (video.remote === true) {
      console.error('Cannot process a remote video')
      process.exit(-1)
    }

    if (video.isLive) {
      console.error('Cannot process live video')
      process.exit(-1)
    }

    if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
      console.error('This video is already being moved to external storage')
      process.exit(-1)
    }

    ids.push(video.id)
  } else {
    ids = await VideoModel.listLocalIds()
  }

  for (const id of ids) {
    const videoFull = await VideoModel.loadFull(id)

    if (videoFull.isLive) continue

    const files = videoFull.VideoFiles || []
    const hls = videoFull.getHLSPlaylist()

    if (files.some(f => f.storage === VideoStorage.FILE_SYSTEM) || hls?.storage === VideoStorage.FILE_SYSTEM) {
      console.log('Processing video %s.', videoFull.name)

      const success = await moveToExternalStorageState({ video: videoFull, isNewVideo: false, transaction: undefined })

      if (!success) {
        console.error(
          'Cannot create move job for %s: job creation may have failed or there may be pending transcoding jobs for this video',
          videoFull.name
        )
      }
    }

    console.log(`Created move-to-object-storage job for ${videoFull.name}.`)
  }
}
