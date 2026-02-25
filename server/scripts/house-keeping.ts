import { createCommand } from '@commander-js/extra-typings'
import { initDatabaseModels } from '@server/initializers/database.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import Bluebird from 'bluebird'
import { askConfirmation, displayPeerTubeMustBeStoppedWarning } from './shared/common.js'

const program = createCommand()
  .description('Remove remote files')
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

  const thumbnails = await ThumbnailModel.listRemoteCached()
  const actorImages = await ActorImageModel.listRemoteCached()
  const captions = await VideoCaptionModel.listRemoteCached()
  const storyboards = await StoryboardModel.listRemoteCached()

  if (thumbnails.length === 0 && actorImages.length === 0 && captions.length === 0 && storyboards.length === 0) {
    console.log('No remote files to delete detected.')
    process.exit(0)
  }

  const res = await askConfirmation(
    `${thumbnails.length.toLocaleString()} thumbnails, ` +
      `${actorImages.length.toLocaleString()} avatars/banners, ` +
      `${captions.length.toLocaleString()} captions and ` +
      `${storyboards.length.toLocaleString()} storyboards ` +
      `can be locally deleted. ` +
      `PeerTube will download them again on-demand. ` +
      `Do you want to delete these remote files?`
  )

  if (res !== true) {
    console.log('Exiting without deleting remote files.')
    process.exit(0)
  }

  // ---------------------------------------------------------------------------

  console.log('Deleting remote thumbnails...')

  await Bluebird.map(thumbnails, async thumbnail => {
    await thumbnail.removeFile()

    thumbnail.cached = false
    await thumbnail.save()
  }, { concurrency: 20 })

  // ---------------------------------------------------------------------------

  console.log('Deleting remote avatars/banners...')

  await Bluebird.map(actorImages, async actorImage => {
    await actorImage.removeFile()

    actorImage.cached = false
    await actorImage.save()
  }, { concurrency: 20 })

  console.log('Remote files deleted!')

  // ---------------------------------------------------------------------------

  console.log('Deleting remote captions...')

  await Bluebird.map(captions, async caption => {
    await caption.removeCaptionFile()

    caption.cached = false
    await caption.save()
  }, { concurrency: 20 })

  console.log('Remote caption files deleted!')

  // ---------------------------------------------------------------------------

  console.log('Deleting remote storyboards...')

  await Bluebird.map(storyboards, async storyboard => {
    await storyboard.removeFile()

    storyboard.cached = false
    await storyboard.save()
  }, { concurrency: 20 })

  console.log('Remote storyboard files deleted!')
}
