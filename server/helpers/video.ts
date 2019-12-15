import { VideoModel } from '../models/video/video'
import * as Bluebird from 'bluebird'
import {
  MVideoAccountLightBlacklistAllFiles,
  MVideoFullLight,
  MVideoIdThumbnail,
  MVideoThumbnail,
  MVideoWithRights
} from '@server/typings/models'
import { Response } from 'express'

type VideoFetchType = 'all' | 'only-video' | 'only-video-with-rights' | 'id' | 'none'

function fetchVideo (id: number | string, fetchType: 'all', userId?: number): Bluebird<MVideoFullLight>
function fetchVideo (id: number | string, fetchType: 'only-video', userId?: number): Bluebird<MVideoThumbnail>
function fetchVideo (id: number | string, fetchType: 'only-video-with-rights', userId?: number): Bluebird<MVideoWithRights>
function fetchVideo (id: number | string, fetchType: 'id' | 'none', userId?: number): Bluebird<MVideoIdThumbnail>
function fetchVideo (
  id: number | string,
  fetchType: VideoFetchType,
  userId?: number
): Bluebird<MVideoFullLight | MVideoThumbnail | MVideoWithRights | MVideoIdThumbnail>
function fetchVideo (
  id: number | string,
  fetchType: VideoFetchType,
  userId?: number
): Bluebird<MVideoFullLight | MVideoThumbnail | MVideoWithRights | MVideoIdThumbnail> {
  if (fetchType === 'all') return VideoModel.loadAndPopulateAccountAndServerAndTags(id, undefined, userId)

  if (fetchType === 'only-video-with-rights') return VideoModel.loadWithRights(id)

  if (fetchType === 'only-video') return VideoModel.load(id)

  if (fetchType === 'id' || fetchType === 'none') return VideoModel.loadOnlyId(id)
}

type VideoFetchByUrlType = 'all' | 'only-video'

function fetchVideoByUrl (url: string, fetchType: 'all'): Bluebird<MVideoAccountLightBlacklistAllFiles>
function fetchVideoByUrl (url: string, fetchType: 'only-video'): Bluebird<MVideoThumbnail>
function fetchVideoByUrl (url: string, fetchType: VideoFetchByUrlType): Bluebird<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail>
function fetchVideoByUrl (url: string, fetchType: VideoFetchByUrlType): Bluebird<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail> {
  if (fetchType === 'all') return VideoModel.loadByUrlAndPopulateAccount(url)

  if (fetchType === 'only-video') return VideoModel.loadByUrl(url)
}

function getVideoWithAttributes (res: Response) {
  return res.locals.videoAll || res.locals.onlyVideo || res.locals.onlyVideoWithRights
}

export {
  VideoFetchType,
  VideoFetchByUrlType,
  fetchVideo,
  getVideoWithAttributes,
  fetchVideoByUrl
}
