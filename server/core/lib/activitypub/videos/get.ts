import { APObjectId } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { loadVideoByUrl } from '@server/lib/model-loaders/index.js'
import { AutoBlacklistStatus } from '@server/lib/video-blacklist.js'
import { MVideoAccountLightBlacklistAllFiles, MVideoImmutable, MVideoThumbnails, MVideoWithBlacklist } from '@server/types/models/index.js'
import { getAPId } from '../activity.js'
import { refreshVideoIfNeeded, scheduleVideoRefreshIfNeeded } from './refresh.js'
import { APVideoCreator, fetchRemoteVideo, SyncParam, syncVideoExternalAttributes } from './shared/index.js'

const logger = createLogger('ap', 'video')

type GetVideoResult<T> = Promise<{
  video: T
  created: boolean
  autoBlacklistStatus?: AutoBlacklistStatus
}>

type GetVideoParamAll = {
  videoObject: APObjectId
  syncParam?: SyncParam
  fetchType?: 'full'
  allowRefresh?: boolean
}

type GetVideoParamImmutable = {
  videoObject: APObjectId
  syncParam?: SyncParam
  fetchType: 'unsafe-immutable-only'
  allowRefresh: false
}

type GetVideoParamOther = {
  videoObject: APObjectId
  syncParam?: SyncParam
  fetchType?: 'full' | 'with-blacklist'
  allowRefresh?: boolean
}

export function getOrCreateAPVideo (options: GetVideoParamAll): GetVideoResult<MVideoAccountLightBlacklistAllFiles>
export function getOrCreateAPVideo (options: GetVideoParamImmutable): GetVideoResult<MVideoImmutable>
export function getOrCreateAPVideo (
  options: GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoWithBlacklist>
export async function getOrCreateAPVideo (
  options: GetVideoParamAll | GetVideoParamImmutable | GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoWithBlacklist | MVideoImmutable> {
  return getOrCreateAPVideoInternal(options, { alreadyRetried: false })
}

// Concurrent calls for the same remote video are expected: View/Download activities are processed in parallel
// while Create/Announce for the same video are processed sequentially
type GetVideoContext = {
  alreadyRetried: boolean
}

async function getOrCreateAPVideoInternal (
  options: GetVideoParamAll | GetVideoParamImmutable | GetVideoParamOther,
  context: GetVideoContext
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoWithBlacklist | MVideoImmutable> {
  // Default params
  const syncParam = options.syncParam || { rates: true, shares: true, comments: true, refreshVideo: false }
  const fetchType = options.fetchType || 'full'
  const allowRefresh = options.allowRefresh !== false

  // Get video url
  const videoUrl = getAPId(options.videoObject)

  return logger.withContext([ videoUrl ], async () => {
    const videoFromDatabase = await loadVideoByUrl(videoUrl, fetchType)

    if (videoFromDatabase) {
      // We know that allowRefresh === false on `unsafe-only-immutable-attributes` fetch type because of type definitions
      let video = videoFromDatabase as MVideoThumbnails

      if (allowRefresh === true && video.isOutdated()) {
        if (syncParam.refreshVideo === true) {
          video = await refreshVideoIfNeeded({
            video,
            fetchedType: fetchType,
            syncParam
          })
        } else {
          scheduleVideoRefreshIfNeeded(video)
        }
      }

      return { video: videoFromDatabase, created: false }
    }

    const { videoObject } = await fetchRemoteVideo(videoUrl)
    if (!videoObject) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

    // videoUrl is just an alias/redirection, so process object id instead
    if (videoObject.id !== videoUrl) return getOrCreateAPVideoInternal({ ...options, fetchType: 'full', videoObject }, context)

    try {
      const creator = new APVideoCreator(videoObject)
      const { autoBlacklistStatus, videoCreated } = await retryTransactionWrapper(() => creator.create())

      await syncVideoExternalAttributes(videoCreated, videoObject, syncParam)

      return { video: videoCreated, created: true, autoBlacklistStatus }
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err

      // Maybe a concurrent getOrCreateAPVideo call created this video
      const alreadyCreatedVideo = await loadVideoByUrl(videoUrl, fetchType)
      if (alreadyCreatedVideo) return { video: alreadyCreatedVideo, created: false }

      if (context.alreadyRetried !== true) {
        logger.debug('Cannot create video %s because of a concurrent creation, retrying.', videoUrl, { err })

        return getOrCreateAPVideoInternal(options, { ...context, alreadyRetried: true })
      }

      logger.error('Cannot create video %s because of SequelizeUniqueConstraintError error, but cannot find it in database.', videoUrl)

      throw err
    }
  })
}

export function maybeGetOrCreateAPVideo (options: GetVideoParamAll): GetVideoResult<MVideoAccountLightBlacklistAllFiles>
export function maybeGetOrCreateAPVideo (options: GetVideoParamImmutable): GetVideoResult<MVideoImmutable>
export function maybeGetOrCreateAPVideo (
  options: GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoWithBlacklist>
export async function maybeGetOrCreateAPVideo (options: GetVideoParamAll | GetVideoParamImmutable | GetVideoParamOther) {
  try {
    const result = await getOrCreateAPVideo(options as any)

    return result
  } catch (err) {
    logger.debug('Cannot fetch remote video ' + options.videoObject + ': maybe not a video object?', { err })
    return { video: undefined, created: false }
  }
}
