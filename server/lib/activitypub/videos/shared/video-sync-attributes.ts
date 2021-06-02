import { logger } from '@server/helpers/logger'
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

import Bluebird = require('bluebird')

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

  const jobPayloads: ActivitypubHttpFetcherPayload[] = []

  if (syncParam.likes === true) {
    const handler = items => createRates(items, video, 'like')
    const cleaner = crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, 'like' as 'like', crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.likes, handler, cleaner)
      .catch(err => logger.error('Cannot add likes of video %s.', video.uuid, { err, rootUrl: fetchedVideo.likes }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.likes, videoId: video.id, type: 'video-likes' as 'video-likes' })
  }

  if (syncParam.dislikes === true) {
    const handler = items => createRates(items, video, 'dislike')
    const cleaner = crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, 'dislike' as 'dislike', crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.dislikes, handler, cleaner)
      .catch(err => logger.error('Cannot add dislikes of video %s.', video.uuid, { err, rootUrl: fetchedVideo.dislikes }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.dislikes, videoId: video.id, type: 'video-dislikes' as 'video-dislikes' })
  }

  if (syncParam.shares === true) {
    const handler = items => addVideoShares(items, video)
    const cleaner = crawlStartDate => VideoShareModel.cleanOldSharesOf(video.id, crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.shares, handler, cleaner)
      .catch(err => logger.error('Cannot add shares of video %s.', video.uuid, { err, rootUrl: fetchedVideo.shares }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.shares, videoId: video.id, type: 'video-shares' as 'video-shares' })
  }

  if (syncParam.comments === true) {
    const handler = items => addVideoComments(items)
    const cleaner = crawlStartDate => VideoCommentModel.cleanOldCommentsOf(video.id, crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.comments, handler, cleaner)
      .catch(err => logger.error('Cannot add comments of video %s.', video.uuid, { err, rootUrl: fetchedVideo.comments }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.comments, videoId: video.id, type: 'video-comments' as 'video-comments' })
  }

  await Bluebird.map(jobPayloads, payload => JobQueue.Instance.createJobWithPromise({ type: 'activitypub-http-fetcher', payload }))
}

export {
  SyncParam,
  syncVideoExternalAttributes
}
