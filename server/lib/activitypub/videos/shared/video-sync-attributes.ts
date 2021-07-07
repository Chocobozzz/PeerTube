import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { JobQueue } from '@server/lib/job-queue'
import { AccountVideoRateModel } from '@server/models/account/account-video-rate'
import { VideoCommentModel } from '@server/models/video/video-comment'
import { VideoShareModel } from '@server/models/video/video-share'
import { MVideo } from '@server/types/models'
import { ActivitypubHttpFetcherPayload, VideoObject } from '@shared/models'
import { crawlCollectionPage } from '../../crawl'
import { addVideoShares } from '../../share'
import { addVideoComments } from '../../video-comments'
import { createRates } from '../../video-rates'

const lTags = loggerTagsFactory('ap', 'video')

type SyncParam = {
  likes: boolean
  dislikes: boolean
  shares: boolean
  comments: boolean
  thumbnail: boolean
  refreshVideo?: boolean
}

async function syncVideoExternalAttributes (video: MVideo, fetchedVideo: VideoObject, syncParam: SyncParam) {
  logger.info('Adding likes/dislikes/shares/comments of video %s.', video.uuid)

  await syncRates('like', video, fetchedVideo, syncParam.likes)
  await syncRates('dislike', video, fetchedVideo, syncParam.dislikes)

  await syncShares(video, fetchedVideo, syncParam.shares)

  await syncComments(video, fetchedVideo, syncParam.comments)
}

// ---------------------------------------------------------------------------

export {
  SyncParam,
  syncVideoExternalAttributes
}

// ---------------------------------------------------------------------------

function createJob (payload: ActivitypubHttpFetcherPayload) {
  return JobQueue.Instance.createJobWithPromise({ type: 'activitypub-http-fetcher', payload })
}

function syncRates (type: 'like' | 'dislike', video: MVideo, fetchedVideo: VideoObject, isSync: boolean) {
  const uri = type === 'like'
    ? fetchedVideo.likes
    : fetchedVideo.dislikes

  if (!isSync) {
    const jobType = type === 'like'
      ? 'video-likes'
      : 'video-dislikes'

    return createJob({ uri, videoId: video.id, type: jobType })
  }

  const handler = items => createRates(items, video, type)
  const cleaner = crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, type, crawlStartDate)

  return crawlCollectionPage<string>(uri, handler, cleaner)
    .catch(err => logger.error('Cannot add rate of video %s.', video.uuid, { err, rootUrl: uri, ...lTags(video.uuid, video.url) }))
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
