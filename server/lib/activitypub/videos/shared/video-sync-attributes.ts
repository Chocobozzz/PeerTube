import { runInReadCommittedTransaction } from '@server/helpers/database-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { JobQueue } from '@server/lib/job-queue'
import { VideoModel } from '@server/models/video/video'
import { VideoCommentModel } from '@server/models/video/video-comment'
import { VideoShareModel } from '@server/models/video/video-share'
import { MVideo } from '@server/types/models'
import { ActivitypubHttpFetcherPayload, ActivityPubOrderedCollection, VideoObject } from '@shared/models'
import { fetchAP } from '../../activity'
import { crawlCollectionPage } from '../../crawl'
import { addVideoShares } from '../../share'
import { addVideoComments } from '../../video-comments'

const lTags = loggerTagsFactory('ap', 'video')

type SyncParam = {
  rates: boolean
  shares: boolean
  comments: boolean
  refreshVideo?: boolean
}

async function syncVideoExternalAttributes (
  video: MVideo,
  fetchedVideo: VideoObject,
  syncParam: Pick<SyncParam, 'rates' | 'shares' | 'comments'>
) {
  logger.info('Adding likes/dislikes/shares/comments of video %s.', video.uuid)

  const ratePromise = updateVideoRates(video, fetchedVideo)
  if (syncParam.rates) await ratePromise

  await syncShares(video, fetchedVideo, syncParam.shares)

  await syncComments(video, fetchedVideo, syncParam.comments)
}

async function updateVideoRates (video: MVideo, fetchedVideo: VideoObject) {
  const [ likes, dislikes ] = await Promise.all([
    getRatesCount('like', video, fetchedVideo),
    getRatesCount('dislike', video, fetchedVideo)
  ])

  return runInReadCommittedTransaction(async t => {
    await VideoModel.updateRatesOf(video.id, 'like', likes, t)
    await VideoModel.updateRatesOf(video.id, 'dislike', dislikes, t)
  })
}

// ---------------------------------------------------------------------------

export {
  SyncParam,
  syncVideoExternalAttributes,
  updateVideoRates
}

// ---------------------------------------------------------------------------

async function getRatesCount (type: 'like' | 'dislike', video: MVideo, fetchedVideo: VideoObject) {
  const uri = type === 'like'
    ? fetchedVideo.likes
    : fetchedVideo.dislikes

  logger.info('Sync %s of video %s', type, video.url)

  const { body } = await fetchAP<ActivityPubOrderedCollection<any>>(uri)

  if (isNaN(body.totalItems)) {
    logger.error('Cannot sync %s of video %s, totalItems is not a number', type, video.url, { body })
    return
  }

  return body.totalItems
}

function syncShares (video: MVideo, fetchedVideo: VideoObject, isSync: boolean) {
  const uri = fetchedVideo.shares

  if (!isSync) {
    return createJob({ uri, videoId: video.id, type: 'video-shares' })
  }

  const handler = items => addVideoShares(items, video)
  const cleaner = crawlStartDate => VideoShareModel.cleanOldSharesOf(video.id, crawlStartDate)

  return crawlCollectionPage<string>(uri, handler, cleaner)
    .catch(err => logger.error('Cannot add shares of video %s.', video.uuid, { err, rootUrl: uri, ...lTags(video.uuid, video.url) }))
}

function syncComments (video: MVideo, fetchedVideo: VideoObject, isSync: boolean) {
  const uri = fetchedVideo.comments

  if (!isSync) {
    return createJob({ uri, videoId: video.id, type: 'video-comments' })
  }

  const handler = items => addVideoComments(items)
  const cleaner = crawlStartDate => VideoCommentModel.cleanOldCommentsOf(video.id, crawlStartDate)

  return crawlCollectionPage<string>(uri, handler, cleaner)
    .catch(err => logger.error('Cannot add comments of video %s.', video.uuid, { err, rootUrl: uri, ...lTags(video.uuid, video.url) }))
}

function createJob (payload: ActivitypubHttpFetcherPayload) {
  return JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload })
}
