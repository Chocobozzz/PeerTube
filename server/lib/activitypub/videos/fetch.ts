import { checkUrlsSameHost, getAPId } from "@server/helpers/activitypub"
import { sanitizeAndCheckVideoTorrentObject } from "@server/helpers/custom-validators/activitypub/videos"
import { retryTransactionWrapper } from "@server/helpers/database-utils"
import { logger } from "@server/helpers/logger"
import { doJSONRequest, PeerTubeRequestError } from "@server/helpers/requests"
import { fetchVideoByUrl, VideoFetchByUrlType } from "@server/helpers/video"
import { REMOTE_SCHEME } from "@server/initializers/constants"
import { ActorFollowScoreCache } from "@server/lib/files-cache"
import { JobQueue } from "@server/lib/job-queue"
import { VideoModel } from "@server/models/video/video"
import { MVideoAccountLight, MVideoAccountLightBlacklistAllFiles, MVideoImmutable, MVideoThumbnail } from "@server/types/models"
import { HttpStatusCode } from "@shared/core-utils"
import { VideoObject } from "@shared/models"
import { getOrCreateActorAndServerAndModel } from "../actor"
import { SyncParam, syncVideoExternalAttributes } from "./shared"
import { createVideo } from "./shared/video-create"
import { APVideoUpdater } from "./update"

async function fetchRemoteVideo (videoUrl: string): Promise<{ statusCode: number, videoObject: VideoObject }> {
  logger.info('Fetching remote video %s.', videoUrl)

  const { statusCode, body } = await doJSONRequest<any>(videoUrl, { activityPub: true })

  if (sanitizeAndCheckVideoTorrentObject(body) === false || checkUrlsSameHost(body.id, videoUrl) !== true) {
    logger.debug('Remote video JSON is not valid.', { body })
    return { statusCode, videoObject: undefined }
  }

  return { statusCode, videoObject: body }
}

async function fetchRemoteVideoDescription (video: MVideoAccountLight) {
  const host = video.VideoChannel.Account.Actor.Server.host
  const path = video.getDescriptionAPIPath()
  const url = REMOTE_SCHEME.HTTP + '://' + host + path

  const { body } = await doJSONRequest<any>(url)
  return body.description || ''
}

function getOrCreateVideoChannelFromVideoObject (videoObject: VideoObject) {
  const channel = videoObject.attributedTo.find(a => a.type === 'Group')
  if (!channel) throw new Error('Cannot find associated video channel to video ' + videoObject.url)

  if (checkUrlsSameHost(channel.id, videoObject.id) !== true) {
    throw new Error(`Video channel url ${channel.id} does not have the same host than video object id ${videoObject.id}`)
  }

  return getOrCreateActorAndServerAndModel(channel.id, 'all')
}

type GetVideoResult <T> = Promise<{
  video: T
  created: boolean
  autoBlacklisted?: boolean
}>

type GetVideoParamAll = {
  videoObject: { id: string } | string
  syncParam?: SyncParam
  fetchType?: 'all'
  allowRefresh?: boolean
}

type GetVideoParamImmutable = {
  videoObject: { id: string } | string
  syncParam?: SyncParam
  fetchType: 'only-immutable-attributes'
  allowRefresh: false
}

type GetVideoParamOther = {
  videoObject: { id: string } | string
  syncParam?: SyncParam
  fetchType?: 'all' | 'only-video'
  allowRefresh?: boolean
}

function getOrCreateVideoAndAccountAndChannel (options: GetVideoParamAll): GetVideoResult<MVideoAccountLightBlacklistAllFiles>
function getOrCreateVideoAndAccountAndChannel (options: GetVideoParamImmutable): GetVideoResult<MVideoImmutable>
function getOrCreateVideoAndAccountAndChannel (
  options: GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail>
async function getOrCreateVideoAndAccountAndChannel (
  options: GetVideoParamAll | GetVideoParamImmutable | GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable> {
  // Default params
  const syncParam = options.syncParam || { likes: true, dislikes: true, shares: true, comments: true, thumbnail: true, refreshVideo: false }
  const fetchType = options.fetchType || 'all'
  const allowRefresh = options.allowRefresh !== false

  // Get video url
  const videoUrl = getAPId(options.videoObject)
  let videoFromDatabase = await fetchVideoByUrl(videoUrl, fetchType)

  if (videoFromDatabase) {
    // If allowRefresh is true, we could not call this function using 'only-immutable-attributes' fetch type
    if (allowRefresh === true && (videoFromDatabase as MVideoThumbnail).isOutdated()) {
      const refreshOptions = {
        video: videoFromDatabase as MVideoThumbnail,
        fetchedType: fetchType,
        syncParam
      }

      if (syncParam.refreshVideo === true) {
        videoFromDatabase = await refreshVideoIfNeeded(refreshOptions)
      } else {
        await JobQueue.Instance.createJobWithPromise({
          type: 'activitypub-refresher',
          payload: { type: 'video', url: videoFromDatabase.url }
        })
      }
    }

    return { video: videoFromDatabase, created: false }
  }

  const { videoObject: fetchedVideo } = await fetchRemoteVideo(videoUrl)
  if (!fetchedVideo) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

  const actor = await getOrCreateVideoChannelFromVideoObject(fetchedVideo)
  const videoChannel = actor.VideoChannel

  try {
    const { autoBlacklisted, videoCreated } = await retryTransactionWrapper(createVideo, fetchedVideo, videoChannel, syncParam.thumbnail)

    await syncVideoExternalAttributes(videoCreated, fetchedVideo, syncParam)

    return { video: videoCreated, created: true, autoBlacklisted }
  } catch (err) {
    // Maybe a concurrent getOrCreateVideoAndAccountAndChannel call created this video
    if (err.name === 'SequelizeUniqueConstraintError') {
      const fallbackVideo = await fetchVideoByUrl(videoUrl, fetchType)
      if (fallbackVideo) return { video: fallbackVideo, created: false }
    }

    throw err
  }
}

async function refreshVideoIfNeeded (options: {
  video: MVideoThumbnail
  fetchedType: VideoFetchByUrlType
  syncParam: SyncParam
}): Promise<MVideoThumbnail> {
  if (!options.video.isOutdated()) return options.video

  // We need more attributes if the argument video was fetched with not enough joints
  const video = options.fetchedType === 'all'
    ? options.video as MVideoAccountLightBlacklistAllFiles
    : await VideoModel.loadByUrlAndPopulateAccount(options.video.url)

  try {
    const { videoObject } = await fetchRemoteVideo(video.url)

    if (videoObject === undefined) {
      logger.warn('Cannot refresh remote video %s: invalid body.', video.url)

      await video.setAsRefreshed()
      return video
    }

    const channelActor = await getOrCreateVideoChannelFromVideoObject(videoObject)

    const videoUpdater = new APVideoUpdater({
      video,
      videoObject,
      channel: channelActor.VideoChannel
    })
    await videoUpdater.update()

    await syncVideoExternalAttributes(video, videoObject, options.syncParam)

    ActorFollowScoreCache.Instance.addGoodServerId(video.VideoChannel.Actor.serverId)

    return video
  } catch (err) {
    if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
      logger.info('Cannot refresh remote video %s: video does not exist anymore. Deleting it.', video.url)

      // Video does not exist anymore
      await video.destroy()
      return undefined
    }

    logger.warn('Cannot refresh video %s.', options.video.url, { err })

    ActorFollowScoreCache.Instance.addBadServerId(video.VideoChannel.Actor.serverId)

    // Don't refresh in loop
    await video.setAsRefreshed()
    return video
  }
}

export {
  fetchRemoteVideo,
  fetchRemoteVideoDescription,
  refreshVideoIfNeeded,
  getOrCreateVideoChannelFromVideoObject,
  getOrCreateVideoAndAccountAndChannel
}
