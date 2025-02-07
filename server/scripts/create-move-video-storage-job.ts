import { FileStorage, VideoState } from '@peertube/peertube-models'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { initDatabaseModels } from '@server/initializers/database.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { moveToExternalStorageState, moveToFileSystemState } from '@server/lib/video-state.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylist, MVideoCaption, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { program } from 'commander'

program
  .description('Move videos to another storage.')
  .option('-o, --to-object-storage', 'Move videos in object storage')
  .option('-f, --to-file-system', 'Move videos to file system')
  .option('-v, --video [videoUUID]', 'Move a specific video')
  .option('-a, --all-videos', 'Migrate all videos')
  .parse(process.argv)

const options = program.opts()

if (!options['toObjectStorage'] && !options['toFileSystem']) {
  console.error('You need to choose where to send video files using --to-object-storage or --to-file-system.')
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

    if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE || video.state === VideoState.TO_MOVE_TO_FILE_SYSTEM) {
      console.error('This video is already being moved to external storage/file system')
      process.exit(-1)
    }

    ids.push(video.id)
  } else {
    ids = await VideoModel.listLocalIds()
  }

  for (const id of ids) {
    const videoFull = await VideoModel.loadFull(id)
    if (videoFull.isLive) continue

    if (options['toObjectStorage']) {
      await createMoveJobIfNeeded({
        video: videoFull,
        type: 'to object storage',
        canProcessVideo: (options) => {
          const { files, hls, source, captions } = options

          return files.some(f => f.storage === FileStorage.FILE_SYSTEM) ||
            hls?.storage === FileStorage.FILE_SYSTEM ||
            source?.storage === FileStorage.FILE_SYSTEM ||
            captions.some(c => c.storage === FileStorage.FILE_SYSTEM)
        },
        handler: () => moveToExternalStorageState({ video: videoFull, isNewVideo: false, transaction: undefined })
      })

      continue
    }

    if (options['toFileSystem']) {
      await createMoveJobIfNeeded({
        video: videoFull,
        type: 'to file system',

        canProcessVideo: options => {
          const { files, hls, source, captions } = options

          return files.some(f => f.storage === FileStorage.OBJECT_STORAGE) ||
            hls?.storage === FileStorage.OBJECT_STORAGE ||
            source?.storage === FileStorage.OBJECT_STORAGE ||
            captions.some(c => c.storage === FileStorage.OBJECT_STORAGE)
        },

        handler: () => moveToFileSystemState({ video: videoFull, isNewVideo: false, transaction: undefined })
      })
    }
  }
}

async function createMoveJobIfNeeded (options: {
  video: MVideoFullLight
  type: 'to object storage' | 'to file system'

  canProcessVideo: (options: {
    files: MVideoFile[]
    hls: MStreamingPlaylist
    source: MVideoSource
    captions: MVideoCaption[]
  }) => boolean

  handler: () => Promise<any>
}) {
  const { video, type, canProcessVideo, handler } = options

  const files = video.VideoFiles || []
  const hls = video.getHLSPlaylist()

  const source = await VideoSourceModel.loadLatest(video.id)
  const captions = await VideoCaptionModel.listVideoCaptions(video.id)

  if (canProcessVideo({ files, hls, source, captions })) {
    console.log(`Moving ${type} video ${video.name}`)

    const success = await handler()

    if (!success) {
      console.error(
        `Cannot create move ${type} for ${video.name}: job creation may have failed or there may be pending transcoding jobs for this video`
      )
    } else {
      console.log(`Created job ${type} for ${video.name}.`)
    }
  }
}
