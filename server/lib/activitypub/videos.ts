import { join } from 'path'
import * as request from 'request'
import { ActivityIconObject } from '../../../shared/index'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import { CONFIG, REMOTE_SCHEME, STATIC_PATHS } from '../../initializers/constants'
import { VideoInstance } from '../../models/video/video-interface'

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

export {
  fetchRemoteVideoPreview,
  fetchRemoteVideoDescription,
  generateThumbnailFromUrl
}
