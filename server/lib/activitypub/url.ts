import { CONFIG } from '../../initializers'
import { AccountModel } from '../../models/account/account'
import { AccountFollowModel } from '../../models/account/account-follow'
import { VideoModel } from '../../models/video/video'
import { VideoAbuseModel } from '../../models/video/video-abuse'
import { VideoChannelModel } from '../../models/video/video-channel'

function getVideoActivityPubUrl (video: VideoModel) {
  return CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid
}

function getVideoChannelActivityPubUrl (videoChannel: VideoChannelModel) {
  return CONFIG.WEBSERVER.URL + '/video-channels/' + videoChannel.uuid
}

function getAccountActivityPubUrl (accountName: string) {
  return CONFIG.WEBSERVER.URL + '/account/' + accountName
}

function getVideoAbuseActivityPubUrl (videoAbuse: VideoAbuseModel) {
  return CONFIG.WEBSERVER.URL + '/admin/video-abuses/' + videoAbuse.id
}

function getVideoViewActivityPubUrl (byAccount: AccountModel, video: VideoModel) {
  return video.url + '/views/' + byAccount.uuid + '/' + new Date().toISOString()
}

function getVideoLikeActivityPubUrl (byAccount: AccountModel, video: VideoModel) {
  return byAccount.url + '/likes/' + video.id
}

function getVideoDislikeActivityPubUrl (byAccount: AccountModel, video: VideoModel) {
  return byAccount.url + '/dislikes/' + video.id
}

function getAccountFollowActivityPubUrl (accountFollow: AccountFollowModel) {
  const me = accountFollow.AccountFollower
  const following = accountFollow.AccountFollowing

  return me.url + '/follows/' + following.id
}

function getAccountFollowAcceptActivityPubUrl (accountFollow: AccountFollowModel) {
  const follower = accountFollow.AccountFollower
  const me = accountFollow.AccountFollowing

  return follower.url + '/accepts/follows/' + me.id
}

function getAnnounceActivityPubUrl (originalUrl: string, byAccount: AccountModel) {
  return originalUrl + '/announces/' + byAccount.id
}

function getUpdateActivityPubUrl (originalUrl: string, updatedAt: string) {
  return originalUrl + '/updates/' + updatedAt
}

function getUndoActivityPubUrl (originalUrl: string) {
  return originalUrl + '/undo'
}

export {
  getVideoActivityPubUrl,
  getVideoChannelActivityPubUrl,
  getAccountActivityPubUrl,
  getVideoAbuseActivityPubUrl,
  getAccountFollowActivityPubUrl,
  getAccountFollowAcceptActivityPubUrl,
  getAnnounceActivityPubUrl,
  getUpdateActivityPubUrl,
  getUndoActivityPubUrl,
  getVideoViewActivityPubUrl,
  getVideoLikeActivityPubUrl,
  getVideoDislikeActivityPubUrl
}
