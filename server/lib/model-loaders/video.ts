import { VideoModel } from '@server/models/video/video'
import {
  MVideoAccountLightBlacklistAllFiles,
  MVideoFullLight,
  MVideoIdThumbnail,
  MVideoImmutable,
  MVideoThumbnail,
  MVideoWithRights
} from '@server/types/models'

type VideoLoadType = 'all' | 'only-video' | 'only-video-with-rights' | 'id' | 'none' | 'only-immutable-attributes'

function loadVideo (id: number | string, fetchType: 'all', userId?: number): Promise<MVideoFullLight>
function loadVideo (id: number | string, fetchType: 'only-immutable-attributes'): Promise<MVideoImmutable>
function loadVideo (id: number | string, fetchType: 'only-video', userId?: number): Promise<MVideoThumbnail>
function loadVideo (id: number | string, fetchType: 'only-video-with-rights', userId?: number): Promise<MVideoWithRights>
function loadVideo (id: number | string, fetchType: 'id' | 'none', userId?: number): Promise<MVideoIdThumbnail>
function loadVideo (
  id: number | string,
  fetchType: VideoLoadType,
  userId?: number
): Promise<MVideoFullLight | MVideoThumbnail | MVideoWithRights | MVideoIdThumbnail | MVideoImmutable>
function loadVideo (
  id: number | string,
  fetchType: VideoLoadType,
  userId?: number
): Promise<MVideoFullLight | MVideoThumbnail | MVideoWithRights | MVideoIdThumbnail | MVideoImmutable> {
  if (fetchType === 'all') return VideoModel.loadAndPopulateAccountAndServerAndTags(id, undefined, userId)

  if (fetchType === 'only-immutable-attributes') return VideoModel.loadImmutableAttributes(id)

  if (fetchType === 'only-video-with-rights') return VideoModel.loadWithRights(id)

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
