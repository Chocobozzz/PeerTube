import { VideoPlaylistPrivacy, VideoPlaylistType } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { SequelizeModel } from '@server/models/shared/sequelize-type.js'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { Mutex } from 'async-mutex'
import { copy, remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { Transaction } from 'sequelize'
import { VideoPlaylistModel } from '../models/video/video-playlist.js'
import { MAccount, MVideoPlaylistElement, MVideoThumbnails } from '../types/models/index.js'
import { MVideoPlaylistOwner, MVideoPlaylistThumbnail } from '../types/models/video/video-playlist.js'
import { sendUpdateVideoPlaylist } from './activitypub/send/send-update.js'
import { getLocalVideoPlaylistActivityPubUrl } from './activitypub/url.js'
import downloadImage from './image-downloader.js'
import { createLocalPlaylistThumbnailsFromImage } from './thumbnail.js'

export async function createWatchLaterPlaylist (account: MAccount, t: Transaction) {
  const videoPlaylist: MVideoPlaylistOwner = new VideoPlaylistModel({
    name: 'Watch later',
    privacy: VideoPlaylistPrivacy.PRIVATE,
    type: VideoPlaylistType.WATCH_LATER,
    ownerAccountId: account.id
  })

  videoPlaylist.url = getLocalVideoPlaylistActivityPubUrl(videoPlaylist) // We use the UUID, so set the URL after building the object

  await videoPlaylist.save({ transaction: t })

  videoPlaylist.OwnerAccount = account

  return videoPlaylist
}

// Generate the playlist thumbnail from the thumbnail of the video that has just been added, if the playlist needs one
export function generateThumbnailForPlaylistIfNeeded (options: {
  videoPlaylist: MVideoPlaylistThumbnail
  element: MVideoPlaylistElement
  video: MVideoThumbnails
}) {
  const { videoPlaylist, element, video } = options

  return runInPlaylistThumbnailMutex(videoPlaylist, async () => {
    if (videoPlaylist.shouldGenerateThumbnailWithNewElement(element) !== true) return

    await generateThumbnailForPlaylist(videoPlaylist, video)
  })
}

// The first element of the playlist changed: regenerate the automatic thumbnail from the new first element
export function regeneratePlaylistThumbnailIfNeeded (videoPlaylist: MVideoPlaylistThumbnail) {
  return runInPlaylistThumbnailMutex(videoPlaylist, async () => {
    if (videoPlaylist.hasGeneratedThumbnail() !== true) return

    await videoPlaylist.removeThumbnails(undefined)

    const firstElement = await VideoPlaylistElementModel.loadFirstElementWithVideoThumbnail(videoPlaylist.id)
    if (firstElement) await generateThumbnailForPlaylist(videoPlaylist, firstElement.Video)
  })
}

async function generateThumbnailForPlaylist (videoPlaylist: MVideoPlaylistThumbnail, video: MVideoThumbnails) {
  logger.info('Generating default thumbnail to playlist %s.', videoPlaylist.url)

  const videoThumbnail = video.getBestThumbnail('16:9')
  if (!videoThumbnail) {
    logger.info('Cannot generate thumbnail for playlist %s because video %s does not have any.', videoPlaylist.url, video.url)
    return
  }

  const tmpImageName = generateImageFilename(extname(videoThumbnail.filename))
  const tmpImagePath = join(CONFIG.STORAGE.TMP_DIR, tmpImageName)

  if (video.isLocal() === true) {
    await copy(videoThumbnail.getFSPath(), tmpImagePath)
  } else {
    await downloadImage({
      url: videoThumbnail.fileUrl,
      destDir: CONFIG.STORAGE.TMP_DIR,
      destName: tmpImageName
    })
  }

  try {
    // Another process (or a thumbnail uploaded by the user) can replace the thumbnails of this playlist at the same time:
    // the unique index on the thumbnail size is what prevents duplicates, so just retry and let the last writer win
    await retryTransactionWrapper(async () => {
      // Build the thumbnails inside the retry: sequelize would not insert again the models of a rolled back attempt
      const thumbnails = await createLocalPlaylistThumbnailsFromImage({
        inputPath: tmpImagePath,
        playlist: videoPlaylist,
        automaticallyGenerated: true,
        keepOriginal: true
      })

      try {
        await sequelizeTypescript.transaction(t => videoPlaylist.replaceAndSaveThumbnails(thumbnails, t))
      } catch (err) {
        // The next attempt generates new files, so don't leak the ones we just created
        await Promise.all(
          thumbnails.map(thumbnail => {
            return thumbnail.removeFile()
              .catch(removeErr => logger.error('Cannot remove thumbnail file %s.', thumbnail.filename, { err: removeErr }))
          })
        )

        throw err
      }
    }, { retryUniqueConstraintViolation: true })
  } finally {
    await remove(tmpImagePath)
  }
}

// Multiple requests can concurrently add/remove/reorder elements of the same playlist and so try to generate
// its automatic thumbnail at the same time
const playlistThumbnailMutexes = new Map<number, { mutex: Mutex, users: number }>()

async function runInPlaylistThumbnailMutex<T> (videoPlaylist: MVideoPlaylistThumbnail, fn: () => Promise<T>) {
  const playlistId = videoPlaylist.id

  let entry = playlistThumbnailMutexes.get(playlistId)
  if (!entry) {
    entry = { mutex: new Mutex(), users: 0 }
    playlistThumbnailMutexes.set(playlistId, entry)
  }

  // Count ourselves before waiting for the lock so the entry cannot be removed under us
  entry.users++

  const releaser = await entry.mutex.acquire()

  try {
    await videoPlaylist.reloadThumbnails()

    return await fn()
  } finally {
    releaser()

    entry.users--

    // Don't leak mutexes of playlists that are not updated anymore
    if (entry.users === 0) playlistThumbnailMutexes.delete(playlistId)
  }
}

export async function reorderPlaylistOrElementsPosition<T extends typeof VideoPlaylistElementModel | typeof VideoPlaylistModel> (options: {
  model: T
  instance: SequelizeModel<T>
  start: number
  insertAfter: number
  reorderLength: number
  transaction: Transaction
}) {
  const { model, start, insertAfter, reorderLength, instance, transaction } = options

  // Example: if we reorder position 2 and insert after position 5 (so at position 6): # 1 2 3 4 5 6 7 8 9
  //  * increase position when position > 5 # 1 2 3 4 5 7 8 9 10
  //  * update position 2 -> position 6 # 1 3 4 5 6 7 8 9 10
  //  * decrease position when position position > 2 # 1 2 3 4 5 6 7 8 9

  const newPosition = insertAfter + 1

  // Add space after the position when we want to insert our reordered elements (increase)
  await model.increasePositionOf({
    videoChannelId: instance.id,
    videoPlaylistId: instance.id,
    fromPosition: newPosition,
    by: reorderLength,
    transaction
  })

  let oldPosition = start

  // We incremented the position of the elements we want to reorder
  if (start >= newPosition) oldPosition += reorderLength

  const endOldPosition = oldPosition + reorderLength - 1
  // Insert our reordered elements in their place (update)
  await model.reassignPositionOf({
    videoPlaylistId: instance.id,
    videoChannelId: instance.id,
    firstPosition: oldPosition,
    endPosition: endOldPosition,
    newPosition,
    transaction
  })

  // Decrease positions of elements after the old position of our ordered elements (decrease)
  await model.increasePositionOf({
    videoPlaylistId: instance.id,
    videoChannelId: instance.id,
    fromPosition: oldPosition,
    by: -reorderLength,
    transaction
  })
}

export async function sendPlaylistPositionUpdateOfChannel (channelId: number, transaction: Transaction) {
  const playlists = await VideoPlaylistModel.listPlaylistOfChannel(channelId, transaction)

  for (const playlist of playlists) {
    await sendUpdateVideoPlaylist(playlist, transaction)
  }
}
