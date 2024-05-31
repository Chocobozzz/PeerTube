import { ActivityPubOrderedCollection, ActivitypubHttpFetcherPayload, VideoObject } from '@peertube/peertube-models'
import { runInReadCommittedTransaction } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoShareModel } from '@server/models/video/video-share.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo } from '@server/types/models/index.js'
import { fetchAP } from '../../activity.js'
import { crawlCollectionPage } from '../../crawl.js'
import { addVideoShares } from '../../share.js'
import { addVideoComments } from '../../video-comments.js'

const lTags = loggerTagsFactory('ap', 'video')

export type SyncParam = {
  rates: boolean
  shares: boolean
  comments: boolean
  refreshVideo?: boolean
}

export async function syncVideoExternalAttributes (
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

export async function updateVideoRates (video: MVideo, fetchedVideo: VideoObject) {
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
// Private
// ---------------------------------------------------------------------------

async function getRatesCount (type: 'like' | 'dislike', video: MVideo, fetchedVideo: VideoObject) {
  const uri = type === 'like'
    ? fetchedVideo.likes
    : fetchedVideo.dislikes

  if (!uri) return

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
  if (!uri) return

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
  if (!uri) return

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
