import { Response } from 'express'
import { CONFIG } from '@server/initializers/config'
import {
  isStreamingPlaylist,
  MStreamingPlaylistVideo,
  MVideo,
  MVideoAccountLightBlacklistAllFiles,
  MVideoFullLight,
  MVideoIdThumbnail,
  MVideoImmutable,
  MVideoThumbnail,
  MVideoWithRights
} from '@server/types/models'
import { VideoPrivacy, VideoState } from '@shared/models'
import { VideoModel } from '../models/video/video'

type VideoFetchType = 'all' | 'only-video' | 'only-video-with-rights' | 'id' | 'none' | 'only-immutable-attributes'

function fetchVideo (id: number | string, fetchType: 'all', userId?: number): Promise<MVideoFullLight>
function fetchVideo (id: number | string, fetchType: 'only-immutable-attributes'): Promise<MVideoImmutable>
function fetchVideo (id: number | string, fetchType: 'only-video', userId?: number): Promise<MVideoThumbnail>
function fetchVideo (id: number | string, fetchType: 'only-video-with-rights', userId?: number): Promise<MVideoWithRights>
function fetchVideo (id: number | string, fetchType: 'id' | 'none', userId?: number): Promise<MVideoIdThumbnail>
function fetchVideo (
  id: number | string,
  fetchType: VideoFetchType,
  userId?: number
): Promise<MVideoFullLight | MVideoThumbnail | MVideoWithRights | MVideoIdThumbnail | MVideoImmutable>
function fetchVideo (
  id: number | string,
  fetchType: VideoFetchType,
  userId?: number
): Promise<MVideoFullLight | MVideoThumbnail | MVideoWithRights | MVideoIdThumbnail | MVideoImmutable> {
  if (fetchType === 'all') return VideoModel.loadAndPopulateAccountAndServerAndTags(id, undefined, userId)

  if (fetchType === 'only-immutable-attributes') return VideoModel.loadImmutableAttributes(id)

  if (fetchType === 'only-video-with-rights') return VideoModel.loadWithRights(id)

  if (fetchType === 'only-video') return VideoModel.load(id)

  if (fetchType === 'id' || fetchType === 'none') return VideoModel.loadOnlyId(id)
}

type VideoFetchByUrlType = 'all' | 'only-video' | 'only-immutable-attributes'

function fetchVideoByUrl (url: string, fetchType: 'all'): Promise<MVideoAccountLightBlacklistAllFiles>
function fetchVideoByUrl (url: string, fetchType: 'only-immutable-attributes'): Promise<MVideoImmutable>
function fetchVideoByUrl (url: string, fetchType: 'only-video'): Promise<MVideoThumbnail>
function fetchVideoByUrl (
  url: string,
  fetchType: VideoFetchByUrlType
): Promise<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable>
function fetchVideoByUrl (
  url: string,
  fetchType: VideoFetchByUrlType
): Promise<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable> {
  if (fetchType === 'all') return VideoModel.loadByUrlAndPopulateAccount(url)

  if (fetchType === 'only-immutable-attributes') return VideoModel.loadByUrlImmutableAttributes(url)

  if (fetchType === 'only-video') return VideoModel.loadByUrl(url)
}

function getVideoWithAttributes (res: Response) {
  return res.locals.videoAll || res.locals.onlyVideo || res.locals.onlyVideoWithRights
}

function extractVideo (videoOrPlaylist: MVideo | MStreamingPlaylistVideo) {
  return isStreamingPlaylist(videoOrPlaylist)
    ? videoOrPlaylist.Video
    : videoOrPlaylist
}

function isPrivacyForFederation (privacy: VideoPrivacy) {
  const castedPrivacy = parseInt(privacy + '', 10)

  return castedPrivacy === VideoPrivacy.PUBLIC ||
    (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true && castedPrivacy === VideoPrivacy.UNLISTED)
}

function isStateForFederation (state: VideoState) {
  const castedState = parseInt(state + '', 10)

  return castedState === VideoState.PUBLISHED || castedState === VideoState.WAITING_FOR_LIVE || castedState === VideoState.LIVE_ENDED
}

function getPrivaciesForFederation () {
  return (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true)
    ? [ { privacy: VideoPrivacy.PUBLIC }, { privacy: VideoPrivacy.UNLISTED } ]
    : [ { privacy: VideoPrivacy.PUBLIC } ]
}

function getExtFromMimetype (mimeTypes: { [id: string]: string | string[] }, mimeType: string) {
  const value = mimeTypes[mimeType]

  if (Array.isArray(value)) return value[0]

  return value
}

export {
  VideoFetchType,
  VideoFetchByUrlType,
  fetchVideo,
  getVideoWithAttributes,
  fetchVideoByUrl,
  extractVideo,
  getExtFromMimetype,
  isStateForFederation,
  isPrivacyForFederation,
  getPrivaciesForFederation
}
