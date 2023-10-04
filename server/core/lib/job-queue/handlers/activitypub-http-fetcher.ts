import { Job } from 'bullmq'
import { ActivitypubHttpFetcherPayload, FetchType } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { VideoModel } from '../../../models/video/video.js'
import { VideoCommentModel } from '../../../models/video/video-comment.js'
import { VideoShareModel } from '../../../models/video/video-share.js'
import { MVideoFullLight } from '../../../types/models/index.js'
import { crawlCollectionPage } from '../../activitypub/crawl.js'
import { createAccountPlaylists } from '../../activitypub/playlists/index.js'
import { processActivities } from '../../activitypub/process/index.js'
import { addVideoShares } from '../../activitypub/share.js'
import { addVideoComments } from '../../activitypub/video-comments.js'

async function processActivityPubHttpFetcher (job: Job) {
  logger.info('Processing ActivityPub fetcher in job %s.', job.id)

  const payload = job.data as ActivitypubHttpFetcherPayload

  let video: MVideoFullLight
  if (payload.videoId) video = await VideoModel.loadFull(payload.videoId)

  const fetcherType: { [ id in FetchType ]: (items: any[]) => Promise<any> } = {
    'activity': items => processActivities(items, { outboxUrl: payload.uri, fromFetch: true }),
    'video-shares': items => addVideoShares(items, video),
    'video-comments': items => addVideoComments(items),
    'account-playlists': items => createAccountPlaylists(items)
  }

  const cleanerType: { [ id in FetchType ]?: (crawlStartDate: Date) => Promise<any> } = {
    'video-shares': crawlStartDate => VideoShareModel.cleanOldSharesOf(video.id, crawlStartDate),
    'video-comments': crawlStartDate => VideoCommentModel.cleanOldCommentsOf(video.id, crawlStartDate)
  }

  return crawlCollectionPage(payload.uri, fetcherType[payload.type], cleanerType[payload.type])
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpFetcher
}
