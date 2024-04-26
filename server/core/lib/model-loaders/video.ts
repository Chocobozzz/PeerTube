import { CONFIG } from '@server/initializers/config.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MVideoAccountLightBlacklistAllFiles,
  MVideoFormattableDetails,
  MVideoFullLight,
  MVideoId,
  MVideoImmutable,
  MVideoThumbnailBlacklist
} from '@server/types/models/index.js'
import { getOrCreateAPVideo } from '../activitypub/videos/get.js'

type VideoLoadType = 'for-api' | 'all' | 'only-video-and-blacklist' | 'id' | 'none' | 'unsafe-only-immutable-attributes'

function loadVideo (id: number | string, fetchType: 'for-api', userId?: number): Promise<MVideoFormattableDetails>
function loadVideo (id: number | string, fetchType: 'all', userId?: number): Promise<MVideoFullLight>
function loadVideo (id: number | string, fetchType: 'unsafe-only-immutable-attributes'): Promise<MVideoImmutable>
function loadVideo (id: number | string, fetchType: 'only-video-and-blacklist', userId?: number): Promise<MVideoThumbnailBlacklist>
function loadVideo (id: number | string, fetchType: 'id' | 'none', userId?: number): Promise<MVideoId>
function loadVideo (
  id: number | string,
  fetchType: VideoLoadType,
  userId?: number
): Promise<MVideoFullLight | MVideoThumbnailBlacklist | MVideoId | MVideoImmutable>
function loadVideo (
  id: number | string,
  fetchType: VideoLoadType,
  userId?: number
): Promise<MVideoFullLight | MVideoThumbnailBlacklist | MVideoId | MVideoImmutable> {

  if (fetchType === 'for-api') return VideoModel.loadForGetAPI({ id, userId })

  if (fetchType === 'all') return VideoModel.loadFull(id, undefined, userId)

  if (fetchType === 'unsafe-only-immutable-attributes') return VideoModel.loadImmutableAttributes(id)

  if (fetchType === 'only-video-and-blacklist') return VideoModel.loadWithBlacklist(id)

  if (fetchType === 'id' || fetchType === 'none') return VideoModel.loadOnlyId(id)
}

type VideoLoadByUrlType = 'all' | 'only-video-and-blacklist' | 'unsafe-only-immutable-attributes'

function loadVideoByUrl (url: string, fetchType: 'all'): Promise<MVideoAccountLightBlacklistAllFiles>
function loadVideoByUrl (url: string, fetchType: 'unsafe-only-immutable-attributes'): Promise<MVideoImmutable>
function loadVideoByUrl (url: string, fetchType: 'only-video-and-blacklist'): Promise<MVideoThumbnailBlacklist>
function loadVideoByUrl (
  url: string,
  fetchType: VideoLoadByUrlType
): Promise<MVideoAccountLightBlacklistAllFiles | MVideoThumbnailBlacklist | MVideoImmutable>
function loadVideoByUrl (
  url: string,
  fetchType: VideoLoadByUrlType
): Promise<MVideoAccountLightBlacklistAllFiles | MVideoThumbnailBlacklist | MVideoImmutable> {
  if (fetchType === 'all') return VideoModel.loadByUrlAndPopulateAccountAndFiles(url)

  if (fetchType === 'unsafe-only-immutable-attributes') return VideoModel.loadByUrlImmutableAttributes(url)

  if (fetchType === 'only-video-and-blacklist') return VideoModel.loadByUrlWithBlacklist(url)
}

async function loadOrCreateVideoIfAllowedForUser (videoUrl: string) {
  if (CONFIG.SEARCH.REMOTE_URI.USERS) {
    try {
      const res = await getOrCreateAPVideo({
        videoObject: videoUrl,
        fetchType: 'unsafe-only-immutable-attributes',
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
  loadOrCreateVideoIfAllowedForUser, loadVideo,
  loadVideoByUrl,
  type VideoLoadByUrlType,
  type VideoLoadType
}
