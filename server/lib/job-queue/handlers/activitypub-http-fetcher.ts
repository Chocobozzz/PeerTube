import * as Bull from 'bull'
import { ActivitypubHttpFetcherPayload, FetchType } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoShareModel } from '../../../models/video/video-share'
import { MAccountDefault, MVideoFullLight } from '../../../types/models'
import { crawlCollectionPage } from '../../activitypub/crawl'
import { createAccountPlaylists } from '../../activitypub/playlist'
import { processActivities } from '../../activitypub/process'
import { addVideoShares } from '../../activitypub/share'
import { addVideoComments } from '../../activitypub/video-comments'
import { createRates } from '../../activitypub/video-rates'

async function processActivityPubHttpFetcher (job: Bull.Job) {
  logger.info('Processing ActivityPub fetcher in job %d.', job.id)

  const payload = job.data as ActivitypubHttpFetcherPayload

  let video: MVideoFullLight
  if (payload.videoId) video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoId)

  let account: MAccountDefault
  if (payload.accountId) account = await AccountModel.load(payload.accountId)

  const fetcherType: { [ id in FetchType ]: (items: any[]) => Promise<any> } = {
    'activity': items => processActivities(items, { outboxUrl: payload.uri, fromFetch: true }),
    'video-likes': items => createRates(items, video, 'like'),
    'video-dislikes': items => createRates(items, video, 'dislike'),
    'video-shares': items => addVideoShares(items, video),
    'video-comments': items => addVideoComments(items),
    'account-playlists': items => createAccountPlaylists(items, account)
  }

  const cleanerType: { [ id in FetchType ]?: (crawlStartDate: Date) => Promise<any> } = {
    'video-likes': crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, 'like' as 'like', crawlStartDate),
    'video-dislikes': crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, 'dislike' as 'dislike', crawlStartDate),
    'video-shares': crawlStartDate => VideoShareModel.cleanOldSharesOf(video.id, crawlStartDate),
    'video-comments': crawlStartDate => VideoCommentModel.cleanOldCommentsOf(video.id, crawlStartDate)
  }

  return crawlCollectionPage(payload.uri, fetcherType[payload.type], cleanerType[payload.type])
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpFetcher
}
