import Bluebird from 'bluebird'
import { Job } from 'bullmq'
import {
  isAnnounceActivityValid,
  isDislikeActivityValid,
  isLikeActivityValid
} from '@server/helpers/custom-validators/activitypub/activity.js'
import { sanitizeAndCheckVideoCommentObject } from '@server/helpers/custom-validators/activitypub/video-comments.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { AP_CLEANER } from '@server/initializers/constants.js'
import { fetchAP } from '@server/lib/activitypub/activity.js'
import { checkUrlsSameHost } from '@server/lib/activitypub/url.js'
import { Redis } from '@server/lib/redis.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoShareModel } from '@server/models/video/video-share.js'
import { VideoModel } from '@server/models/video/video.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate.js'

const lTags = loggerTagsFactory('ap-cleaner')

// Job to clean remote interactions off local videos

async function processActivityPubCleaner (_job: Job) {
  logger.info('Processing ActivityPub cleaner.', lTags())

  {
    const rateUrls = await AccountVideoRateModel.listRemoteRateUrlsOfLocalVideos()
    const { bodyValidator, deleter, updater } = rateOptionsFactory()

    await Bluebird.map(rateUrls, async rateUrl => {
      // TODO: remove when https://github.com/mastodon/mastodon/issues/13571 is fixed
      if (rateUrl.includes('#')) return

      const result = await updateObjectIfNeeded({ url: rateUrl, bodyValidator, updater, deleter })

      if (result?.status === 'deleted') {
        const { videoId, type } = result.data

        await VideoModel.syncLocalRates(videoId, type, undefined)
      }
    }, { concurrency: AP_CLEANER.CONCURRENCY })
  }

  {
    const shareUrls = await VideoShareModel.listRemoteShareUrlsOfLocalVideos()
    const { bodyValidator, deleter, updater } = shareOptionsFactory()

    await Bluebird.map(shareUrls, async shareUrl => {
      await updateObjectIfNeeded({ url: shareUrl, bodyValidator, updater, deleter })
    }, { concurrency: AP_CLEANER.CONCURRENCY })
  }

  {
    const commentUrls = await VideoCommentModel.listRemoteCommentUrlsOfLocalVideos()
    const { bodyValidator, deleter, updater } = commentOptionsFactory()

    await Bluebird.map(commentUrls, async commentUrl => {
      await updateObjectIfNeeded({ url: commentUrl, bodyValidator, updater, deleter })
    }, { concurrency: AP_CLEANER.CONCURRENCY })
  }
}

// ---------------------------------------------------------------------------

export {
  processActivityPubCleaner
}

// ---------------------------------------------------------------------------

async function updateObjectIfNeeded <T> (options: {
  url: string
  bodyValidator: (body: any) => boolean
  updater: (url: string, newUrl: string) => Promise<T>
  deleter: (url: string) => Promise<T> }
): Promise<{ data: T, status: 'deleted' | 'updated' } | null> {
  const { url, bodyValidator, updater, deleter } = options

  const on404OrTombstone = async () => {
    logger.info('Removing remote AP object %s.', url, lTags(url))
    const data = await deleter(url)

    return { status: 'deleted' as 'deleted', data }
  }

  try {
    const { body } = await fetchAP<any>(url)

    // If not same id, check same host and update
    if (!body?.id || !bodyValidator(body)) throw new Error(`Body or body id of ${url} is invalid`)

    if (body.type === 'Tombstone') {
      return on404OrTombstone()
    }

    const newUrl = body.id
    if (newUrl !== url) {
      if (checkUrlsSameHost(newUrl, url) !== true) {
        throw new Error(`New url ${newUrl} has not the same host than old url ${url}`)
      }

      logger.info('Updating remote AP object %s.', url, lTags(url))
      const data = await updater(url, newUrl)

      return { status: 'updated', data }
    }

    return null
  } catch (err) {
    // Does not exist anymore, remove entry
    if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
      return on404OrTombstone()
    }

    logger.debug('Remote AP object %s is unavailable.', url, lTags(url))

    const unavailability = await Redis.Instance.addAPUnavailability(url)
    if (unavailability >= AP_CLEANER.UNAVAILABLE_TRESHOLD) {
      logger.info('Removing unavailable AP resource %s.', url, lTags(url))
      return on404OrTombstone()
    }

    return null
  }
}

function rateOptionsFactory () {
  return {
    bodyValidator: (body: any) => isLikeActivityValid(body) || isDislikeActivityValid(body),

    updater: async (url: string, newUrl: string) => {
      const rate = await AccountVideoRateModel.loadByUrl(url, undefined)
      rate.url = newUrl

      const videoId = rate.videoId
      const type = rate.type

      await rate.save()

      return { videoId, type }
    },

    deleter: async (url) => {
      const rate = await AccountVideoRateModel.loadByUrl(url, undefined)

      const videoId = rate.videoId
      const type = rate.type

      await rate.destroy()

      return { videoId, type }
    }
  }
}

function shareOptionsFactory () {
  return {
    bodyValidator: (body: any) => isAnnounceActivityValid(body),

    updater: async (url: string, newUrl: string) => {
      const share = await VideoShareModel.loadByUrl(url, undefined)
      share.url = newUrl

      await share.save()

      return undefined
    },

    deleter: async (url) => {
      const share = await VideoShareModel.loadByUrl(url, undefined)

      await share.destroy()

      return undefined
    }
  }
}

function commentOptionsFactory () {
  return {
    bodyValidator: (body: any) => sanitizeAndCheckVideoCommentObject(body),

    updater: async (url: string, newUrl: string) => {
      const comment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(url)
      comment.url = newUrl

      await comment.save()

      return undefined
    },

    deleter: async (url) => {
      const comment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(url)

      await comment.destroy()

      return undefined
    }
  }
}
