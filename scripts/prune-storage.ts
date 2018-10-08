import * as prompt from 'prompt'
import { join } from 'path'
import { CONFIG } from '../server/initializers/constants'
import { VideoModel } from '../server/models/video/video'
import { initDatabaseModels } from '../server/initializers'
import { remove, readdir } from 'fs-extra'
import { VideoRedundancyModel } from '../server/models/redundancy/video-redundancy'
import { getUUIDFromFilename } from '../server/helpers/utils'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  const storageOnlyOwnedToPrune = [
    CONFIG.STORAGE.VIDEOS_DIR,
    CONFIG.STORAGE.TORRENTS_DIR
  ]

  const storageForAllToPrune = [
    CONFIG.STORAGE.PREVIEWS_DIR,
    CONFIG.STORAGE.THUMBNAILS_DIR
  ]

  let toDelete: string[] = []
  for (const directory of storageOnlyOwnedToPrune) {
    toDelete = toDelete.concat(await pruneDirectory(directory, true))
  }

  for (const directory of storageForAllToPrune) {
    toDelete = toDelete.concat(await pruneDirectory(directory, false))
  }

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

async function pruneDirectory (directory: string, onlyOwned = false) {
  const files = await readdir(directory)

  const toDelete: string[] = []
  for (const file of files) {
    const uuid = getUUIDFromFilename(file)
    let video: VideoModel
    let localRedundancy: boolean

    if (uuid) {
      video = await VideoModel.loadByUUIDWithFile(uuid)
      localRedundancy = await VideoRedundancyModel.isLocalByVideoUUIDExists(uuid)
    }

    if (
      !uuid ||
      !video ||
      (onlyOwned === true && (video.isOwned() === false && localRedundancy === false))
    ) {
      toDelete.push(join(directory, file))
    }
  }

  return toDelete
}

async function askConfirmation () {
  return new Promise((res, rej) => {
    prompt.start()
    const schema = {
      properties: {
        confirm: {
          type: 'string',
          description: 'These following unused files can be deleted, but please check your backups first (bugs happen).' +
            ' Can we delete these files?',
          default: 'n',
          required: true
        }
      }
    }
    prompt.get(schema, function (err, result) {
      if (err) return rej(err)
      return res(result.confirm && result.confirm.match(/y/) !== null)
    })
  })
}
