import * as Sequelize from 'sequelize'
import { AccountModel } from '../models/account/account'
import { VideoPlaylistModel } from '../models/video/video-playlist'
import { VideoPlaylistPrivacy } from '../../shared/models/videos/playlist/video-playlist-privacy.model'
import { getVideoPlaylistActivityPubUrl } from './activitypub'
import { VideoPlaylistType } from '../../shared/models/videos/playlist/video-playlist-type.model'

async function createWatchLaterPlaylist (account: AccountModel, t: Sequelize.Transaction) {
  const videoPlaylist = new VideoPlaylistModel({
    name: 'Watch later',
    privacy: VideoPlaylistPrivacy.PRIVATE,
    type: VideoPlaylistType.WATCH_LATER,
    ownerAccountId: account.id
  })

  videoPlaylist.url = getVideoPlaylistActivityPubUrl(videoPlaylist) // We use the UUID, so set the URL after building the object

  await videoPlaylist.save({ transaction: t })

  videoPlaylist.OwnerAccount = account

  return videoPlaylist
}

// ---------------------------------------------------------------------------

export {
  createWatchLaterPlaylist
}
