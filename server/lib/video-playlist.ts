import * as Sequelize from 'sequelize'
import { VideoPlaylistModel } from '../models/video/video-playlist'
import { VideoPlaylistPrivacy } from '../../shared/models/videos/playlist/video-playlist-privacy.model'
import { getVideoPlaylistActivityPubUrl } from './activitypub/url'
import { VideoPlaylistType } from '../../shared/models/videos/playlist/video-playlist-type.model'
import { MAccount } from '../types/models'
import { MVideoPlaylistOwner } from '../types/models/video/video-playlist'

async function createWatchLaterPlaylist (account: MAccount, t: Sequelize.Transaction) {
  const videoPlaylist: MVideoPlaylistOwner = new VideoPlaylistModel({
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
