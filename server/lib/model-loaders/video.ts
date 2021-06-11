import { VideoModel } from '@server/models/video/video'
import {
  MVideoAccountLightBlacklistAllFiles,
  MVideoFormattableDetails,
  MVideoFullLight,
  MVideoId,
  MVideoImmutable,
  MVideoThumbnail
} from '@server/types/models'
import { Hooks } from '../plugins/hooks'

type VideoLoadType = 'for-api' | 'all' | 'only-video' | 'id' | 'none' | 'only-immutable-attributes'

function loadVideo (id: number | string, fetchType: 'for-api', userId?: number): Promise<MVideoFormattableDetails>
function loadVideo (id: number | string, fetchType: 'all', userId?: number): Promise<MVideoFullLight>
function loadVideo (id: number | string, fetchType: 'only-immutable-attributes'): Promise<MVideoImmutable>
function loadVideo (id: number | string, fetchType: 'only-video', userId?: number): Promise<MVideoThumbnail>
function loadVideo (id: number | string, fetchType: 'id' | 'none', userId?: number): Promise<MVideoId>
function loadVideo (
  id: number | string,
  fetchType: VideoLoadType,
  userId?: number
): Promise<MVideoFullLight | MVideoThumbnail | MVideoId | MVideoImmutable>
function loadVideo (
  id: number | string,
  fetchType: VideoLoadType,
  userId?: number
): Promise<MVideoFullLight | MVideoThumbnail | MVideoId | MVideoImmutable> {

  if (fetchType === 'for-api') {
    return Hooks.wrapPromiseFun(
      VideoModel.loadForGetAPI,
      { id, userId },
      'filter:api.video.get.result'
    )
  }

  if (fetchType === 'all') return VideoModel.loadAndPopulateAccountAndServerAndTags(id, undefined, userId)

  if (fetchType === 'only-immutable-attributes') return VideoModel.loadImmutableAttributes(id)

  if (fetchType === 'only-video') return VideoModel.load(id)

  if (fetchType === 'id' || fetchType === 'none') return VideoModel.loadOnlyId(id)
}

type VideoLoadByUrlType = 'all' | 'only-video' | 'only-immutable-attributes'

function loadVideoByUrl (url: string, fetchType: 'all'): Promise<MVideoAccountLightBlacklistAllFiles>
function loadVideoByUrl (url: string, fetchType: 'only-immutable-attributes'): Promise<MVideoImmutable>
function loadVideoByUrl (url: string, fetchType: 'only-video'): Promise<MVideoThumbnail>
function loadVideoByUrl (
  url: string,
  fetchType: VideoLoadByUrlType
): Promise<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable>
function loadVideoByUrl (
  url: string,
  fetchType: VideoLoadByUrlType
): Promise<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable> {
  if (fetchType === 'all') return VideoModel.loadByUrlAndPopulateAccount(url)

  if (fetchType === 'only-immutable-attributes') return VideoModel.loadByUrlImmutableAttributes(url)

  if (fetchType === 'only-video') return VideoModel.loadByUrl(url)
}

export {
  VideoLoadType,
  VideoLoadByUrlType,

  loadVideo,
  loadVideoByUrl
}
