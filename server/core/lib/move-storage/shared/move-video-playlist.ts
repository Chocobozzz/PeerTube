import { FileStorageType } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { sendUpdateVideoPlaylist } from '@server/lib/activitypub/send/index.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { moveCommonFile } from './move-common-file.js'

const logger = createLogger()

export async function moveVideoPlaylistToStorage (options: {
  videoPlaylistId: number
  targetStorage: FileStorageType
}) {
  const { videoPlaylistId, targetStorage } = options

  const playlist = await VideoPlaylistModel.loadWithAccountAndChannel(videoPlaylistId, undefined)

  if (!playlist) {
    logger.info(`Can't process video playlist ${videoPlaylistId}, playlist does not exist anymore.`)
    return
  }

  if (!playlist.isLocal()) {
    logger.info(`Can't process video playlist ${videoPlaylistId}, playlist is remote.`)
    return
  }

  const thumbnails = await ThumbnailModel.listOf({ videoPlaylistId })

  let moved = false

  for (const thumbnail of thumbnails) {
    if (!thumbnail.isLocal() || thumbnail.storage === targetStorage) continue

    if (await moveCommonFile({ type: 'thumbnails', filename: thumbnail.filename, fsPath: thumbnail.getFSPath(), targetStorage })) {
      moved = true
    }
  }

  if (!moved) return

  // The thumbnail URLs changed, so the playlist must be federated again
  // Reload them: the thumbnails loaded with the playlist still have their previous storage
  await playlist.reloadThumbnails()

  await sequelizeTypescript.transaction(t => sendUpdateVideoPlaylist(playlist, t))
}
