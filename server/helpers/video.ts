import { VideoModel } from '../models/video/video'
import * as Bluebird from 'bluebird'
import {
  isStreamingPlaylist,
  MStreamingPlaylistVideo,
  MVideo,
  MVideoAccountLightBlacklistAllFiles,
  MVideoFile,
  MVideoFullLight,
  MVideoIdThumbnail,
  MVideoImmutable,
  MVideoThumbnail,
  MVideoWithRights
} from '@server/types/models'
import { Response } from 'express'
import { DEFAULT_AUDIO_RESOLUTION } from '@server/initializers/constants'
import { JobQueue } from '@server/lib/job-queue'
import { VideoPrivacy, VideoTranscodingPayload } from '@shared/models'
import { CONFIG } from "@server/initializers/config"

type VideoFetchType = 'all' | 'only-video' | 'only-video-with-rights' | 'id' | 'none' | 'only-immutable-attributes'

function fetchVideo (id: number | string, fetchType: 'all', userId?: number): Bluebird<MVideoFullLight>
function fetchVideo (id: number | string, fetchType: 'only-immutable-attributes'): Bluebird<MVideoImmutable>
function fetchVideo (id: number | string, fetchType: 'only-video', userId?: number): Bluebird<MVideoThumbnail>
function fetchVideo (id: number | string, fetchType: 'only-video-with-rights', userId?: number): Bluebird<MVideoWithRights>
function fetchVideo (id: number | string, fetchType: 'id' | 'none', userId?: number): Bluebird<MVideoIdThumbnail>
function fetchVideo (
  id: number | string,
  fetchType: VideoFetchType,
  userId?: number
): Bluebird<MVideoFullLight | MVideoThumbnail | MVideoWithRights | MVideoIdThumbnail | MVideoImmutable>
function fetchVideo (
  id: number | string,
  fetchType: VideoFetchType,
  userId?: number
): Bluebird<MVideoFullLight | MVideoThumbnail | MVideoWithRights | MVideoIdThumbnail | MVideoImmutable> {
  if (fetchType === 'all') return VideoModel.loadAndPopulateAccountAndServerAndTags(id, undefined, userId)

  if (fetchType === 'only-immutable-attributes') return VideoModel.loadImmutableAttributes(id)

  if (fetchType === 'only-video-with-rights') return VideoModel.loadWithRights(id)

  if (fetchType === 'only-video') return VideoModel.load(id)

  if (fetchType === 'id' || fetchType === 'none') return VideoModel.loadOnlyId(id)
}

type VideoFetchByUrlType = 'all' | 'only-video' | 'only-immutable-attributes'

function fetchVideoByUrl (url: string, fetchType: 'all'): Bluebird<MVideoAccountLightBlacklistAllFiles>
function fetchVideoByUrl (url: string, fetchType: 'only-immutable-attributes'): Bluebird<MVideoImmutable>
function fetchVideoByUrl (url: string, fetchType: 'only-video'): Bluebird<MVideoThumbnail>
function fetchVideoByUrl (
  url: string,
  fetchType: VideoFetchByUrlType
): Bluebird<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable>
function fetchVideoByUrl (
  url: string,
  fetchType: VideoFetchByUrlType
): Bluebird<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable> {
  if (fetchType === 'all') return VideoModel.loadByUrlAndPopulateAccount(url)

  if (fetchType === 'only-immutable-attributes') return VideoModel.loadByUrlImmutableAttributes(url)

  if (fetchType === 'only-video') return VideoModel.loadByUrl(url)
}

function getVideoWithAttributes (res: Response) {
  return res.locals.videoAll || res.locals.onlyVideo || res.locals.onlyVideoWithRights
}

function addOptimizeOrMergeAudioJob (video: MVideo, videoFile: MVideoFile) {
  let dataInput: VideoTranscodingPayload

  if (videoFile.isAudio()) {
    dataInput = {
      type: 'merge-audio' as 'merge-audio',
      resolution: DEFAULT_AUDIO_RESOLUTION,
      videoUUID: video.uuid,
      isNewVideo: true
    }
  } else {
    dataInput = {
      type: 'optimize' as 'optimize',
      videoUUID: video.uuid,
      isNewVideo: true
    }
  }

  return JobQueue.Instance.createJobWithPromise({ type: 'video-transcoding', payload: dataInput })
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

function getPrivaciesForFederation () {
  return (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true)
    ? [ { privacy: VideoPrivacy.PUBLIC }, { privacy: VideoPrivacy.UNLISTED } ]
    : [ { privacy: VideoPrivacy.PUBLIC } ]
}

export {
  VideoFetchType,
  VideoFetchByUrlType,
  fetchVideo,
  getVideoWithAttributes,
  fetchVideoByUrl,
  addOptimizeOrMergeAudioJob,
  extractVideo,
  isPrivacyForFederation,
  getPrivaciesForFederation
}
