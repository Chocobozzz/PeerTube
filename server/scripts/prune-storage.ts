import Bluebird from 'bluebird'
import { remove } from 'fs-extra/esm'
import { readdir, stat } from 'fs/promises'
import { basename, join } from 'path'
import prompt from 'prompt'
import { uniqify } from '@peertube/peertube-core-utils'
import { ThumbnailType, ThumbnailType_Type } from '@peertube/peertube-models'
import { DIRECTORIES } from '@server/initializers/constants.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { getUUIDFromFilename } from '../core/helpers/utils.js'
import { CONFIG } from '../core/initializers/config.js'
import { initDatabaseModels } from '../core/initializers/database.js'
import { ActorImageModel } from '../core/models/actor/actor-image.js'
import { VideoRedundancyModel } from '../core/models/redundancy/video-redundancy.js'
import { ThumbnailModel } from '../core/models/video/thumbnail.js'
import { VideoModel } from '../core/models/video/video.js'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  const dirs = Object.values(CONFIG.STORAGE)

  if (uniqify(dirs).length !== dirs.length) {
    console.error('Cannot prune storage because you put multiple storage keys in the same directory.')
    process.exit(0)
  }

  await initDatabaseModels(true)

  let toDelete: string[] = []

  console.log('Detecting files to remove, it could take a while...')

  toDelete = toDelete.concat(
    await pruneDirectory(DIRECTORIES.WEB_VIDEOS.PUBLIC, doesWebVideoFileExist()),
    await pruneDirectory(DIRECTORIES.WEB_VIDEOS.PRIVATE, doesWebVideoFileExist()),

    await pruneDirectory(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, doesHLSPlaylistExist()),
    await pruneDirectory(DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC, doesHLSPlaylistExist()),

    await pruneDirectory(CONFIG.STORAGE.TORRENTS_DIR, doesTorrentFileExist()),

    await pruneDirectory(CONFIG.STORAGE.REDUNDANCY_DIR, doesRedundancyExist),

    await pruneDirectory(CONFIG.STORAGE.PREVIEWS_DIR, doesThumbnailExist(true, ThumbnailType.PREVIEW)),
    await pruneDirectory(CONFIG.STORAGE.THUMBNAILS_DIR, doesThumbnailExist(false, ThumbnailType.MINIATURE)),

    await pruneDirectory(CONFIG.STORAGE.ACTOR_IMAGES_DIR, doesActorImageExist)
  )

  const tmpFiles = await readdir(CONFIG.STORAGE.TMP_DIR)
  toDelete = toDelete.concat(tmpFiles.map(t => join(CONFIG.STORAGE.TMP_DIR, t)))

  if (toDelete.length === 0) {
    console.log('No files to delete.')
    return
  }

  console.log('Will delete %d files:\n\n%s\n\n', toDelete.length, toDelete.join('\n'))

  const res = await askConfirmation()
  if (res === true) {
    console.log('Processing delete...\n')

    for (const path of toDelete) {
      await remove(path)
    }

    console.log('Done!')
  } else {
    console.log('Exiting without deleting files.')
  }
}

type ExistFun = (file: string) => Promise<boolean> | boolean
async function pruneDirectory (directory: string, existFun: ExistFun) {
  const files = await readdir(directory)

  const toDelete: string[] = []
  await Bluebird.map(files, async file => {
    const filePath = join(directory, file)

    if (await existFun(filePath) !== true) {
      toDelete.push(filePath)
    }
  }, { concurrency: 20 })

  return toDelete
}

function doesWebVideoFileExist () {
  return (filePath: string) => {
    // Don't delete private directory
    if (filePath === DIRECTORIES.WEB_VIDEOS.PRIVATE) return true

    return VideoFileModel.doesOwnedWebVideoFileExist(basename(filePath))
  }
}

function doesHLSPlaylistExist () {
  return (hlsPath: string) => {
    // Don't delete private directory
    if (hlsPath === DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE) return true

    return VideoStreamingPlaylistModel.doesOwnedHLSPlaylistExist(basename(hlsPath))
  }
}

function doesTorrentFileExist () {
  return (filePath: string) => VideoFileModel.doesOwnedTorrentFileExist(basename(filePath))
}

function doesThumbnailExist (keepOnlyOwned: boolean, type: ThumbnailType_Type) {
  return async (filePath: string) => {
    const thumbnail = await ThumbnailModel.loadByFilename(basename(filePath), type)
    if (!thumbnail) return false

    if (keepOnlyOwned) {
      const video = await VideoModel.load(thumbnail.videoId)
      if (video.isOwned() === false) return false
    }

    return true
  }
}

async function doesActorImageExist (filePath: string) {
  const image = await ActorImageModel.loadByName(basename(filePath))

  return !!image
}

async function doesRedundancyExist (filePath: string) {
  const isPlaylist = (await stat(filePath)).isDirectory()

  if (isPlaylist) {
    // Don't delete HLS redundancy directory
    if (filePath === DIRECTORIES.HLS_REDUNDANCY) return true

    const uuid = getUUIDFromFilename(filePath)
    const video = await VideoModel.loadWithFiles(uuid)
    if (!video) return false

    const p = video.getHLSPlaylist()
    if (!p) return false

    const redundancy = await VideoRedundancyModel.loadLocalByStreamingPlaylistId(p.id)
    return !!redundancy
  }

  const file = await VideoFileModel.loadByFilename(basename(filePath))
  if (!file) return false

  const redundancy = await VideoRedundancyModel.loadLocalByFileId(file.id)
  return !!redundancy
}

async function askConfirmation () {
  return new Promise((res, rej) => {
    prompt.start()

    const schema = {
      properties: {
        confirm: {
          type: 'string',
          description: 'These following unused files can be deleted, but please check your backups first (bugs happen).' +
            ' Notice PeerTube must have been stopped when your ran this script.' +
            ' Can we delete these files?',
          default: 'n',
          required: true
        }
      }
    }

    prompt.get(schema, function (err, result) {
      if (err) return rej(err)

      return res(result.confirm?.match(/y/) !== null)
    })
  })
}
