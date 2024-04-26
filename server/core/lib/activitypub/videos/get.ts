import { APObjectId } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger } from '@server/helpers/logger.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { loadVideoByUrl, VideoLoadByUrlType } from '@server/lib/model-loaders/index.js'
import {
  MVideoAccountLightBlacklistAllFiles,
  MVideoImmutable,
  MVideoThumbnail,
  MVideoThumbnailBlacklist
} from '@server/types/models/index.js'
import { getAPId } from '../activity.js'
import { refreshVideoIfNeeded } from './refresh.js'
import { APVideoCreator, fetchRemoteVideo, SyncParam, syncVideoExternalAttributes } from './shared/index.js'

type GetVideoResult <T> = Promise<{
  video: T
  created: boolean
  autoBlacklisted?: boolean
}>

type GetVideoParamAll = {
  videoObject: APObjectId
  syncParam?: SyncParam
  fetchType?: 'all'
  allowRefresh?: boolean
}

type GetVideoParamImmutable = {
  videoObject: APObjectId
  syncParam?: SyncParam
  fetchType: 'unsafe-only-immutable-attributes'
  allowRefresh: false
}

type GetVideoParamOther = {
  videoObject: APObjectId
  syncParam?: SyncParam
  fetchType?: 'all' | 'only-video-and-blacklist'
  allowRefresh?: boolean
}

export function getOrCreateAPVideo (options: GetVideoParamAll): GetVideoResult<MVideoAccountLightBlacklistAllFiles>
export function getOrCreateAPVideo (options: GetVideoParamImmutable): GetVideoResult<MVideoImmutable>
export function getOrCreateAPVideo (
  options: GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnailBlacklist>
export async function getOrCreateAPVideo (
  options: GetVideoParamAll | GetVideoParamImmutable | GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnailBlacklist | MVideoImmutable> {
  // Default params
  const syncParam = options.syncParam || { rates: true, shares: true, comments: true, refreshVideo: false }
  const fetchType = options.fetchType || 'all'
  const allowRefresh = options.allowRefresh !== false

  // Get video url
  const videoUrl = getAPId(options.videoObject)
  let videoFromDatabase = await loadVideoByUrl(videoUrl, fetchType)

  if (videoFromDatabase) {
    if (allowRefresh === true) {
      // Typings ensure allowRefresh === false in unsafe-only-immutable-attributes fetch type
      videoFromDatabase = await scheduleRefresh(videoFromDatabase as MVideoThumbnail, fetchType, syncParam)
    }

    return { video: videoFromDatabase, created: false }
  }

  const { videoObject } = await fetchRemoteVideo(videoUrl)
  if (!videoObject) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

  // videoUrl is just an alias/redirection, so process object id instead
  if (videoObject.id !== videoUrl) return getOrCreateAPVideo({ ...options, fetchType: 'all', videoObject })

  try {
    const creator = new APVideoCreator(videoObject)
    const { autoBlacklisted, videoCreated } = await retryTransactionWrapper(creator.create.bind(creator))

    await syncVideoExternalAttributes(videoCreated, videoObject, syncParam)

    return { video: videoCreated, created: true, autoBlacklisted }
  } catch (err) {
    // Maybe a concurrent getOrCreateAPVideo call created this video
    if (err.name === 'SequelizeUniqueConstraintError') {
      const alreadyCreatedVideo = await loadVideoByUrl(videoUrl, fetchType)
      if (alreadyCreatedVideo) return { video: alreadyCreatedVideo, created: false }

      logger.error('Cannot create video %s because of SequelizeUniqueConstraintError error, but cannot find it in database.', videoUrl)
    }

    throw err
  }
}

export function maybeGetOrCreateAPVideo (options: GetVideoParamAll): GetVideoResult<MVideoAccountLightBlacklistAllFiles>
export function maybeGetOrCreateAPVideo (options: GetVideoParamImmutable): GetVideoResult<MVideoImmutable>
export function maybeGetOrCreateAPVideo (
  options: GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnailBlacklist>
export async function maybeGetOrCreateAPVideo (options: GetVideoParamAll | GetVideoParamImmutable | GetVideoParamOther) {
  try {
    const result = await getOrCreateAPVideo(options as any)

    return result
  } catch (err) {
    logger.debug('Cannot fetch remote video ' + options.videoObject + ': maybe not a video object?', { err })
    return { video: undefined, created: false }
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function scheduleRefresh (video: MVideoThumbnail, fetchType: VideoLoadByUrlType, syncParam: SyncParam) {
  if (!video.isOutdated()) return video

  const refreshOptions = {
    video,
    fetchedType: fetchType,
    syncParam
  }

  if (syncParam.refreshVideo === true) {
    return refreshVideoIfNeeded(refreshOptions)
  }

  await JobQueue.Instance.createJob({
    type: 'activitypub-refresher',
    payload: { type: 'video', url: video.url }
  })

  return video
}
