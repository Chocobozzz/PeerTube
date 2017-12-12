import { join } from 'path'
import * as request from 'request'
import { Transaction } from 'sequelize'
import { ActivityIconObject } from '../../../shared/index'
import { doRequest, doRequestAndSaveToFile } from '../../helpers'
import { CONFIG, REMOTE_SCHEME, STATIC_PATHS } from '../../initializers'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import {
  sendCreateDislikeToOrigin,
  sendCreateDislikeToVideoFollowers,
  sendLikeToOrigin,
  sendLikeToVideoFollowers,
  sendUndoDislikeToOrigin,
  sendUndoDislikeToVideoFollowers,
  sendUndoLikeToOrigin,
  sendUndoLikeToVideoFollowers
} from './send'

function fetchRemoteVideoPreview (video: VideoModel) {
  // FIXME: use url
  const host = video.VideoChannel.Account.Server.host
  const path = join(STATIC_PATHS.PREVIEWS, video.getPreviewName())

  return request.get(REMOTE_SCHEME.HTTP + '://' + host + path)
}

async function fetchRemoteVideoDescription (video: VideoModel) {
  // FIXME: use url
  const host = video.VideoChannel.Account.Server.host
  const path = video.getDescriptionPath()
  const options = {
    uri: REMOTE_SCHEME.HTTP + '://' + host + path,
    json: true
  }

  const { body } = await doRequest(options)
  return body.description ? body.description : ''
}

function generateThumbnailFromUrl (video: VideoModel, icon: ActivityIconObject) {
  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName)

  const options = {
    method: 'GET',
    uri: icon.url
  }
  return doRequestAndSaveToFile(options, thumbnailPath)
}

async function sendVideoRateChangeToFollowers (
    account: AccountModel,
  video: VideoModel,
  likes: number,
  dislikes: number,
  t: Transaction
) {
  // Keep the order: first we undo and then we create

  // Undo Like
  if (likes < 0) await sendUndoLikeToVideoFollowers(account, video, t)
  // Undo Dislike
  if (dislikes < 0) await sendUndoDislikeToVideoFollowers(account, video, t)

  // Like
  if (likes > 0) await sendLikeToVideoFollowers(account, video, t)
  // Dislike
  if (dislikes > 0) await sendCreateDislikeToVideoFollowers(account, video, t)
}

async function sendVideoRateChangeToOrigin (
    account: AccountModel,
  video: VideoModel,
  likes: number,
  dislikes: number,
  t: Transaction
) {
  // Keep the order: first we undo and then we create

  // Undo Like
  if (likes < 0) await sendUndoLikeToOrigin(account, video, t)
  // Undo Dislike
  if (dislikes < 0) await sendUndoDislikeToOrigin(account, video, t)

  // Like
  if (likes > 0) await sendLikeToOrigin(account, video, t)
  // Dislike
  if (dislikes > 0) await sendCreateDislikeToOrigin(account, video, t)
}

export {
  fetchRemoteVideoPreview,
  fetchRemoteVideoDescription,
  generateThumbnailFromUrl,
  sendVideoRateChangeToFollowers,
  sendVideoRateChangeToOrigin
}
