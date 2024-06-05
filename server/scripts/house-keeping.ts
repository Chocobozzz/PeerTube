import { createCommand } from '@commander-js/extra-typings'
import { initDatabaseModels } from '@server/initializers/database.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { askConfirmation, displayPeerTubeMustBeStoppedWarning } from './shared/common.js'

const program = createCommand()
  .description('Remove unused objects from database or remote files')
  .option('--delete-remote-files', 'Remove remote files (avatars, banners, thumbnails...)')
  .parse(process.argv)

const options = program.opts()

if (!options.deleteRemoteFiles) {
  console.log('At least one option must be set (for example --delete-remote-files).')
  process.exit(0)
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  displayPeerTubeMustBeStoppedWarning()

  if (options.deleteRemoteFiles) {
    return deleteRemoteFiles()
  }
}

async function deleteRemoteFiles () {
  console.log('Detecting remote files that can be deleted...')

  const thumbnails = await ThumbnailModel.listRemoteOnDisk()
  const actorImages = await ActorImageModel.listRemoteOnDisk()

  if (thumbnails.length === 0 && actorImages.length === 0) {
    console.log('No remote files to delete detected.')
    process.exit(0)
  }

  const res = await askConfirmation(
    `${thumbnails.length} thumbnails and ${actorImages.length} avatars/banners can be locally deleted. ` +
    `PeerTube will download them again on-demand.` +
    `Do you want to delete these remote files?`
  )

  if (res !== true) {
    console.log('Exiting without delete remote files.')
    process.exit(0)
  }

  // ---------------------------------------------------------------------------

  console.log('Deleting remote thumbnails...')

  for (const thumbnail of thumbnails) {
    if (!thumbnail.fileUrl) {
      console.log(`Skipping thumbnail removal of ${thumbnail.getPath()} as we don't have its remote file URL in the database.`)
      continue
    }

    await thumbnail.removeThumbnail()

    thumbnail.onDisk = false
    await thumbnail.save()
  }

  // ---------------------------------------------------------------------------

  console.log('Deleting remote avatars/banners...')

  for (const actorImage of actorImages) {
    if (!actorImage.fileUrl) {
      console.log(`Skipping avatar/banner removal of ${actorImage.getPath()} as we don't have its remote file URL in the database.`)
      continue
    }

    await actorImage.removeImage()

    actorImage.onDisk = false
    await actorImage.save()
  }

  console.log('Remote files deleted!')
}
