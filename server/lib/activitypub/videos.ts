import { join } from 'path'
import * as request from 'request'
import { Transaction } from 'sequelize'
import { ActivityIconObject } from '../../../shared/index'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import { CONFIG, REMOTE_SCHEME, STATIC_PATHS } from '../../initializers/constants'
import { AccountInstance } from '../../models/account/account-interface'
import { VideoInstance } from '../../models/video/video-interface'
import { sendLikeToOrigin } from './index'
import { sendCreateDislikeToOrigin, sendCreateDislikeToVideoFollowers } from './send/send-create'
import { sendLikeToVideoFollowers } from './send/send-like'
import {
  sendUndoDislikeToOrigin,
  sendUndoDislikeToVideoFollowers,
  sendUndoLikeToOrigin,
  sendUndoLikeToVideoFollowers
} from './send/send-undo'

function fetchRemoteVideoPreview (video: VideoInstance) {
  // FIXME: use url
  const host = video.VideoChannel.Account.Server.host
  const path = join(STATIC_PATHS.PREVIEWS, video.getPreviewName())

  return request.get(REMOTE_SCHEME.HTTP + '://' + host + path)
}

async function fetchRemoteVideoDescription (video: VideoInstance) {
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

function generateThumbnailFromUrl (video: VideoInstance, icon: ActivityIconObject) {
  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName)

  const options = {
    method: 'GET',
    uri: icon.url
  }
  return doRequestAndSaveToFile(options, thumbnailPath)
}

function sendVideoRateChangeToFollowers (account: AccountInstance, video: VideoInstance, likes: number, dislikes: number, t: Transaction) {
  const tasks: Promise<any>[] = []

  // Undo Like
  if (likes < 0) tasks.push(sendUndoLikeToVideoFollowers(account, video, t))
  // Like
  if (likes > 0) tasks.push(sendLikeToVideoFollowers(account, video, t))

  // Undo Dislike
  if (dislikes < 0) tasks.push(sendUndoDislikeToVideoFollowers(account, video, t))
  // Dislike
  if (dislikes > 0) tasks.push(sendCreateDislikeToVideoFollowers(account, video, t))

  return Promise.all(tasks)
}

function sendVideoRateChangeToOrigin (account: AccountInstance, video: VideoInstance, likes: number, dislikes: number, t: Transaction) {
  const tasks: Promise<any>[] = []

  // Undo Like
  if (likes < 0) tasks.push(sendUndoLikeToOrigin(account, video, t))
  // Like
  if (likes > 0) tasks.push(sendLikeToOrigin(account, video, t))

  // Undo Dislike
  if (dislikes < 0) tasks.push(sendUndoDislikeToOrigin(account, video, t))
  // Dislike
  if (dislikes > 0) tasks.push(sendCreateDislikeToOrigin(account, video, t))

  return Promise.all(tasks)
}

export {
  fetchRemoteVideoPreview,
  fetchRemoteVideoDescription,
  generateThumbnailFromUrl,
  sendVideoRateChangeToFollowers,
  sendVideoRateChangeToOrigin
}
