import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as prompt from 'prompt'
import { join } from 'path'
import { CONFIG } from '../server/initializers/config'
import { VideoModel } from '../server/models/video/video'
import { initDatabaseModels } from '../server/initializers/database'
import { readdir, remove } from 'fs-extra'
import { VideoRedundancyModel } from '../server/models/redundancy/video-redundancy'
import * as Bluebird from 'bluebird'
import { getUUIDFromFilename } from '../server/helpers/utils'
import { ThumbnailModel } from '../server/models/video/thumbnail'
import { AvatarModel } from '../server/models/avatar/avatar'
import { uniq, values } from 'lodash'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  const dirs = values(CONFIG.STORAGE)

  if (uniq(dirs).length !== dirs.length) {
    console.error('Cannot prune storage because you put multiple storage keys in the same directory.')
    process.exit(0)
  }

  await initDatabaseModels(true)

  let toDelete: string[] = []

  toDelete = toDelete.concat(
    await pruneDirectory(CONFIG.STORAGE.VIDEOS_DIR, doesVideoExist(true)),
    await pruneDirectory(CONFIG.STORAGE.TORRENTS_DIR, doesVideoExist(true)),

    await pruneDirectory(CONFIG.STORAGE.REDUNDANCY_DIR, doesRedundancyExist),

    await pruneDirectory(CONFIG.STORAGE.PREVIEWS_DIR, doesThumbnailExist(true)),
    await pruneDirectory(CONFIG.STORAGE.THUMBNAILS_DIR, doesThumbnailExist(false)),

    await pruneDirectory(CONFIG.STORAGE.AVATARS_DIR, doesAvatarExist)
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

type ExistFun = (file: string) => Promise<boolean>
async function pruneDirectory (directory: string, existFun: ExistFun) {
  const files = await readdir(directory)

  const toDelete: string[] = []
  await Bluebird.map(files, async file => {
    if (await existFun(file) !== true) {
      toDelete.push(join(directory, file))
    }
  }, { concurrency: 20 })

  return toDelete
}

function doesVideoExist (keepOnlyOwned: boolean) {
  return async (file: string) => {
    const uuid = getUUIDFromFilename(file)
    const video = await VideoModel.loadByUUID(uuid)

    return video && (keepOnlyOwned === false || video.isOwned())
  }
}

function doesThumbnailExist (keepOnlyOwned: boolean) {
  return async (file: string) => {
    const thumbnail = await ThumbnailModel.loadByName(file)
    if (!thumbnail) return false

    if (keepOnlyOwned) {
      const video = await VideoModel.load(thumbnail.videoId)
      if (video.isOwned() === false) return false
    }

    return true
  }
}

async function doesAvatarExist (file: string) {
  const avatar = await AvatarModel.loadByName(file)

  return !!avatar
}

async function doesRedundancyExist (file: string) {
  const uuid = getUUIDFromFilename(file)
  const video = await VideoModel.loadWithFiles(uuid)

  if (!video) return false

  const isPlaylist = file.includes('.') === false

  if (isPlaylist) {
    const p = video.getHLSPlaylist()
    if (!p) return false

    const redundancy = await VideoRedundancyModel.loadLocalByStreamingPlaylistId(p.id)
    return !!redundancy
  }

  const resolution = parseInt(file.split('-')[5], 10)
  if (isNaN(resolution)) {
    console.error('Cannot prune %s because we cannot guess guess the resolution.', file)
    return true
  }

  const videoFile = video.getWebTorrentFile(resolution)
  if (!videoFile) {
    console.error('Cannot find webtorrent file of video %s - %d', video.url, resolution)
    return true
  }

  const redundancy = await VideoRedundancyModel.loadLocalByFileId(videoFile.id)
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
