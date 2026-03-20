import { CONFIG } from '@server/initializers/config.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MVideoAccountLightBlacklistAllFiles,
  MVideoFormattableDetails,
  MVideoFull,
  MVideoId,
  MVideoImmutable,
  MVideoThumbnails,
  MVideoWithBlacklist,
  MVideoWithRights
} from '@server/types/models/index.js'
import { getOrCreateAPVideo } from '../activitypub/videos/get.js'

type VideoLoadType =
  | 'for-api'
  | 'full'
  | 'with-blacklist'
  | 'with-thumbnails'
  | 'with-rights'
  | 'id'
  | 'none'
  | 'unsafe-immutable-only'

function loadVideo (id: number | string, fetchType: 'for-api', userId?: number): Promise<MVideoFormattableDetails>
function loadVideo (id: number | string, fetchType: 'full', userId?: number): Promise<MVideoFull>
function loadVideo (id: number | string, fetchType: 'with-blacklist', userId?: number): Promise<MVideoWithBlacklist>
function loadVideo (id: number | string, fetchType: 'with-thumbnails', userId?: number): Promise<MVideoThumbnails>
function loadVideo (id: number | string, fetchType: 'id' | 'none', userId?: number): Promise<MVideoId>
function loadVideo (id: number | string, fetchType: 'unsafe-immutable-only'): Promise<MVideoImmutable>
function loadVideo (id: number | string, fetchType: 'with-rights'): Promise<MVideoWithRights>
function loadVideo (
  id: number | string,
  fetchType: VideoLoadType,
  userId?: number
): Promise<MVideoFull | MVideoWithBlacklist | MVideoId | MVideoImmutable | MVideoThumbnails | MVideoWithRights>
function loadVideo (
  id: number | string,
  fetchType: VideoLoadType,
  userId?: number
): Promise<MVideoFull | MVideoWithBlacklist | MVideoId | MVideoImmutable | MVideoThumbnails> {
  if (fetchType === 'for-api') return VideoModel.loadForGetAPI({ id, userId })

  if (fetchType === 'full') return VideoModel.loadFull(id, undefined, userId)

  if (fetchType === 'unsafe-immutable-only') return VideoModel.loadImmutableAttributes(id)

  if (fetchType === 'with-blacklist') return VideoModel.loadWithBlacklist(id)

  if (fetchType === 'with-thumbnails') return VideoModel.loadWithThumbnails(id)

  if (fetchType === 'with-rights') return VideoModel.loadWithRights(id)

  if (fetchType === 'id' || fetchType === 'none') return VideoModel.loadOnlyId(id)
}

type VideoLoadByUrlType = 'full' | 'with-blacklist' | 'unsafe-immutable-only'

function loadVideoByUrl (url: string, fetchType: 'full'): Promise<MVideoAccountLightBlacklistAllFiles>
function loadVideoByUrl (url: string, fetchType: 'unsafe-immutable-only'): Promise<MVideoImmutable>
function loadVideoByUrl (url: string, fetchType: 'with-blacklist'): Promise<MVideoWithBlacklist>
function loadVideoByUrl (
  url: string,
  fetchType: VideoLoadByUrlType
): Promise<MVideoAccountLightBlacklistAllFiles | MVideoWithBlacklist | MVideoImmutable>
function loadVideoByUrl (
  url: string,
  fetchType: VideoLoadByUrlType
): Promise<MVideoAccountLightBlacklistAllFiles | MVideoWithBlacklist | MVideoImmutable> {
  if (fetchType === 'full') return VideoModel.loadByUrlAndPopulateAccountAndFiles(url)

  if (fetchType === 'unsafe-immutable-only') return VideoModel.loadByUrlImmutableAttributes(url)

  if (fetchType === 'with-blacklist') return VideoModel.loadByUrlWithBlacklist(url)
}

async function loadOrCreateVideoIfAllowedForUser (videoUrl: string) {
  if (CONFIG.SEARCH.REMOTE_URI.USERS) {
    try {
      const res = await getOrCreateAPVideo({
        videoObject: videoUrl,
        fetchType: 'unsafe-immutable-only',
        allowRefresh: false
      })

      return res?.video
    } catch {
      return undefined
    }
  }

  return VideoModel.loadByUrlImmutableAttributes(videoUrl)
}

export {
  loadOrCreateVideoIfAllowedForUser,
  loadVideo,
  loadVideoByUrl,
  type VideoLoadByUrlType,
  type VideoLoadType
}
