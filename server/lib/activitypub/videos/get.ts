import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { logger } from '@server/helpers/logger'
import { JobQueue } from '@server/lib/job-queue'
import { loadVideoByUrl, VideoLoadByUrlType } from '@server/lib/model-loaders'
import { MVideoAccountLightBlacklistAllFiles, MVideoImmutable, MVideoThumbnail } from '@server/types/models'
import { APObjectId } from '@shared/models'
import { getAPId } from '../activity'
import { refreshVideoIfNeeded } from './refresh'
import { APVideoCreator, fetchRemoteVideo, SyncParam, syncVideoExternalAttributes } from './shared'

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
  fetchType: 'only-immutable-attributes'
  allowRefresh: false
}

type GetVideoParamOther = {
  videoObject: APObjectId
  syncParam?: SyncParam
  fetchType?: 'all' | 'only-video'
  allowRefresh?: boolean
}

function getOrCreateAPVideo (options: GetVideoParamAll): GetVideoResult<MVideoAccountLightBlacklistAllFiles>
function getOrCreateAPVideo (options: GetVideoParamImmutable): GetVideoResult<MVideoImmutable>
function getOrCreateAPVideo (options: GetVideoParamOther): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail>

async function getOrCreateAPVideo (
  options: GetVideoParamAll | GetVideoParamImmutable | GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable> {
  // Default params
  const syncParam = options.syncParam || { rates: true, shares: true, comments: true, thumbnail: true, refreshVideo: false }
  const fetchType = options.fetchType || 'all'
  const allowRefresh = options.allowRefresh !== false

  // Get video url
  const videoUrl = getAPId(options.videoObject)
  let videoFromDatabase = await loadVideoByUrl(videoUrl, fetchType)

  if (videoFromDatabase) {
    if (allowRefresh === true) {
      // Typings ensure allowRefresh === false in only-immutable-attributes fetch type
      videoFromDatabase = await scheduleRefresh(videoFromDatabase as MVideoThumbnail, fetchType, syncParam)
    }

    return { video: videoFromDatabase, created: false }
  }

  const { videoObject } = await fetchRemoteVideo(videoUrl)
  if (!videoObject) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

  // videoUrl is just an alias/rediraction, so process object id instead
  if (videoObject.id !== videoUrl) return getOrCreateAPVideo({ ...options, fetchType: 'all', videoObject })

  try {
    const creator = new APVideoCreator(videoObject)
    const { autoBlacklisted, videoCreated } = await retryTransactionWrapper(creator.create.bind(creator), syncParam.thumbnail)

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

// ---------------------------------------------------------------------------

export {
  getOrCreateAPVideo
}

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
