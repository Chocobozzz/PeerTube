import * as Sequelize from 'sequelize'
import { VideoPlaylistPrivacy, VideoPlaylistType } from '@peertube/peertube-models'
import { VideoPlaylistModel } from '../models/video/video-playlist.js'
import { MAccount } from '../types/models/index.js'
import { MVideoPlaylistOwner } from '../types/models/video/video-playlist.js'
import { getLocalVideoPlaylistActivityPubUrl } from './activitypub/url.js'

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
