import * as Sequelize from 'sequelize'
import { VideoPlaylistPrivacy } from '../../shared/models/videos/playlist/video-playlist-privacy.model'
import { VideoPlaylistType } from '../../shared/models/videos/playlist/video-playlist-type.model'
import { VideoPlaylistModel } from '../models/video/video-playlist'
import { MAccount } from '../types/models'
import { MVideoPlaylistOwner } from '../types/models/video/video-playlist'
import { getLocalVideoPlaylistActivityPubUrl } from './activitypub/url'

async function createWatchLaterPlaylist (account: MAccount, t: Sequelize.Transaction) {
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

// ---------------------------------------------------------------------------

export {
  createWatchLaterPlaylist
}
