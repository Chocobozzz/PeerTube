import { VideoPlaylistPrivacy, VideoPlaylistType } from '@peertube/peertube-models'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { SequelizeModel } from '@server/models/shared/sequelize-type.js'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { copy } from 'fs-extra/esm'
import { extname, join } from 'path'
import { Transaction } from 'sequelize'
import { VideoPlaylistModel } from '../models/video/video-playlist.js'
import { MAccount, MVideoThumbnail } from '../types/models/index.js'
import { MVideoPlaylistOwner, MVideoPlaylistThumbnail } from '../types/models/video/video-playlist.js'
import { sendUpdateVideoPlaylist } from './activitypub/send/send-update.js'
import { getLocalVideoPlaylistActivityPubUrl } from './activitypub/url.js'
import { createLocalPlaylistThumbnailFromImage } from './thumbnail.js'
import { downloadImageFromWorker } from './worker/parent-process.js'

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

export async function generateThumbnailForPlaylist (videoPlaylist: MVideoPlaylistThumbnail, video: MVideoThumbnail) {
  logger.info('Generating default thumbnail to playlist %s.', videoPlaylist.url)

  const videoThumbnail = video.getBestThumbnail()
  if (!videoThumbnail) {
    logger.info('Cannot generate thumbnail for playlist %s because video %s does not have any.', videoPlaylist.url, video.url)
    return
  }

  const tmpImageName = generateImageFilename(extname(videoThumbnail.filename))

  if (video.isLocal() === true) {
    await copy(videoThumbnail.getFSPath(), join(CONFIG.STORAGE.TMP_DIR, tmpImageName))
  } else {
    await downloadImageFromWorker({
      url: videoThumbnail.fileUrl,
      destDir: CONFIG.STORAGE.TMP_DIR,
      destName: tmpImageName,
      size: {
        height: videoThumbnail.height || 280,
        width: videoThumbnail.width || 157
      }
    })
  }

  const thumbnailModel = await createLocalPlaylistThumbnailFromImage({
    inputPath: join(CONFIG.STORAGE.TMP_DIR, tmpImageName),
    playlist: videoPlaylist,
    automaticallyGenerated: true,
    keepOriginal: false
  })

  thumbnailModel.videoPlaylistId = videoPlaylist.id

  videoPlaylist.Thumbnail = await thumbnailModel.save()
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
