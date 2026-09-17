import { createCommand } from '@commander-js/extra-typings'
import { FileStorage, FileStorageType, VideoState } from '@peertube/peertube-models'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { initDatabaseModels } from '@server/initializers/database.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { checkVideoResourcesToBeMoved } from '@server/lib/move-storage/shared/move-video.js'
import { isObjectStorageEnabledFor, ObjectStorageSectionType } from '@server/lib/object-storage/config.js'
import { buildMoveVideoJob } from '@server/lib/video-jobs.js'
import { moveToStorageAndUpdateState } from '@server/lib/video-state.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { UploadImageModel } from '@server/models/application/upload-image.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFull } from '@server/types/models/index.js'

const program = createCommand()
  .description('Move files to another storage.')
  .option('-v, --video <videoUUID>', 'Move a specific video')
  .option('-a, --all-videos', 'Migrate all videos')
  .option('--all-playlists', 'Migrate the thumbnails of all local playlists')
  .option('--all-actor-images', 'Migrate all local avatars and banners')
  .option('--all-uploads', 'Migrate all instance logos and other admin/user uploads')
  .option('--all', 'Migrate everything the options above can migrate')
  .option('-o, --to-object-storage', 'Move files in object storage')
  .option('-f, --to-file-system', 'Move files to file system')
  .option('--force', 'Force the migration even if the video is already in a "Moving" state')
  .parse(process.argv)

const options = program.opts()

const moveVideos = !!(options.video || options.allVideos || options.all)
let movePlaylists = !!(options.allPlaylists || options.all)
let moveActorImages = !!(options.allActorImages || options.all)
let moveUploads = !!(options.allUploads || options.all)

const targetStorage = options.toObjectStorage
  ? FileStorage.OBJECT_STORAGE
  : FileStorage.FILE_SYSTEM

const targetLabel = options.toObjectStorage
  ? 'to object storage'
  : 'to file system'

if (!options.toObjectStorage && !options.toFileSystem) {
  console.error('You need to choose where to send files using --to-object-storage or --to-file-system.')
  process.exit(-1)
}

if (!moveVideos && !movePlaylists && !moveActorImages && !moveUploads) {
  console.error('You need to choose which files to move.')
  process.exit(-1)
}

if (options.toObjectStorage) {
  if (!CONFIG.OBJECT_STORAGE.ENABLED) {
    console.error('Object storage is not enabled on this instance.')
    process.exit(-1)
  }

  // Playlist thumbnails, avatars and uploads have no other file type to fall back on
  if (movePlaylists) {
    movePlaylists = canMoveToObjectStorage({ type: 'thumbnails', label: 'playlist thumbnails', explicit: !!options.allPlaylists })
  }

  if (moveActorImages) {
    moveActorImages = canMoveToObjectStorage({ type: 'avatars', label: 'actor images', explicit: !!options.allActorImages })
  }

  if (moveUploads) {
    moveUploads = canMoveToObjectStorage({ type: 'uploads', label: 'uploads', explicit: !!options.allUploads })
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

// Explicitly requested files must be enabled in object storage, but --all skips the ones that are not
function canMoveToObjectStorage (options: {
  type: ObjectStorageSectionType
  label: string
  explicit: boolean
}) {
  const { type, label, explicit } = options

  if (isObjectStorageEnabledFor(type)) return true

  const message = `object_storage.${type}.enabled is false, cannot move ${label} to object storage.`

  if (explicit) {
    console.error(message)
    process.exit(-1)
  }

  console.warn(`${message} Skipping them.`)

  return false
}

async function run () {
  await initDatabaseModels(true)

  JobQueue.Instance.init()

  if (moveVideos) await runVideos()
  if (movePlaylists) await runPlaylists()
  if (moveActorImages) await runActorImages()
  if (moveUploads) await runUploads()
}

async function runPlaylists () {
  for (const id of await VideoPlaylistModel.listLocalIdsToMove(targetStorage)) {
    console.log(`Moving ${targetLabel} thumbnails of playlist ${id}`)

    await JobQueue.Instance.createJob({ type: moveJobType(), payload: { videoPlaylistId: id } })
  }
}

async function runActorImages () {
  for (const id of await ActorImageModel.listLocalActorIdsToMove(targetStorage)) {
    console.log(`Moving ${targetLabel} images of actor ${id}`)

    await JobQueue.Instance.createJob({ type: moveJobType(), payload: { actorId: id } })
  }
}

async function runUploads () {
  for (const id of await UploadImageModel.listLocalIdsToMove(targetStorage)) {
    console.log(`Moving ${targetLabel} upload image ${id}`)

    await JobQueue.Instance.createJob({ type: moveJobType(), payload: { uploadImageId: id } })
  }
}

function moveJobType () {
  return options.toObjectStorage
    ? 'move-to-object-storage' as const
    : 'move-to-file-system' as const
}

async function runVideos () {
  let ids: number[] = []

  if (options.video) {
    const video = await VideoModel.load(toCompleteUUID(options.video))

    if (!video) {
      console.error('Unknown video ' + options.video)
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

    if (
      options.force !== true &&
      (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE || video.state === VideoState.TO_MOVE_TO_FILE_SYSTEM)
    ) {
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

    if (options.toObjectStorage) {
      await createMoveJobIfNeeded({ video: videoFull, targetStorage: FileStorage.OBJECT_STORAGE })

      continue
    }

    if (options.toFileSystem) {
      await createMoveJobIfNeeded({ video: videoFull, targetStorage: FileStorage.FILE_SYSTEM })
    }
  }
}

async function createMoveJobIfNeeded (options: {
  video: MVideoFull
  targetStorage: FileStorageType
}) {
  const { video, targetStorage } = options

  const { videoFiles, otherFiles } = await checkVideoResourcesToBeMoved(video, targetStorage)
  if (!videoFiles && !otherFiles) return

  const type = targetStorage === FileStorage.OBJECT_STORAGE
    ? 'to object storage'
    : 'to file system'

  // Thumbnails, torrents and storyboards can be moved without taking the video out of its published state
  if (!videoFiles) {
    console.log(`Moving ${type} thumbnails, torrents and storyboard of video ${video.name}`)

    await JobQueue.Instance.createJob(await buildMoveVideoJob({ type: moveJobType(), video }))

    console.log(`Created job ${type} for ${video.name}.`)
    return
  }

  console.log(`Moving ${type} video ${video.name}`)

  const success = await moveToStorageAndUpdateState({ video, targetStorage, transaction: undefined })

  if (!success) {
    console.error(
      `Cannot create move ${type} for ${video.name}: job creation may have failed or there may be pending transcoding jobs for this video`
    )
  } else {
    console.log(`Created job ${type} for ${video.name}.`)
  }
}
