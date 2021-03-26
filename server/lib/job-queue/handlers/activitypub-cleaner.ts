import * as Bluebird from 'bluebird'
import * as Bull from 'bull'
import { checkUrlsSameHost } from '@server/helpers/activitypub'
import {
  isAnnounceActivityValid,
  isDislikeActivityValid,
  isLikeActivityValid
} from '@server/helpers/custom-validators/activitypub/activity'
import { sanitizeAndCheckVideoCommentObject } from '@server/helpers/custom-validators/activitypub/video-comments'
import { doJSONRequest, PeerTubeRequestError } from '@server/helpers/requests'
import { AP_CLEANER_CONCURRENCY } from '@server/initializers/constants'
import { VideoModel } from '@server/models/video/video'
import { VideoCommentModel } from '@server/models/video/video-comment'
import { VideoShareModel } from '@server/models/video/video-share'
import { HttpStatusCode } from '@shared/core-utils'
import { logger } from '../../../helpers/logger'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'

// Job to clean remote interactions off local videos

async function processActivityPubCleaner (_job: Bull.Job) {
  logger.info('Processing ActivityPub cleaner.')

  {
    const rateUrls = await AccountVideoRateModel.listRemoteRateUrlsOfLocalVideos()
    const { bodyValidator, deleter, updater } = rateOptionsFactory()

    await Bluebird.map(rateUrls, async rateUrl => {
      try {
        const result = await updateObjectIfNeeded(rateUrl, bodyValidator, updater, deleter)

        if (result?.status === 'deleted') {
          const { videoId, type } = result.data

          await VideoModel.updateRatesOf(videoId, type, undefined)
        }
      } catch (err) {
        logger.warn('Cannot update/delete remote AP rate %s.', rateUrl, { err })
      }
    }, { concurrency: AP_CLEANER_CONCURRENCY })
  }

  {
    const shareUrls = await VideoShareModel.listRemoteShareUrlsOfLocalVideos()
    const { bodyValidator, deleter, updater } = shareOptionsFactory()

    await Bluebird.map(shareUrls, async shareUrl => {
      try {
        await updateObjectIfNeeded(shareUrl, bodyValidator, updater, deleter)
      } catch (err) {
        logger.warn('Cannot update/delete remote AP share %s.', shareUrl, { err })
      }
    }, { concurrency: AP_CLEANER_CONCURRENCY })
  }

  {
    const commentUrls = await VideoCommentModel.listRemoteCommentUrlsOfLocalVideos()
    const { bodyValidator, deleter, updater } = commentOptionsFactory()

    await Bluebird.map(commentUrls, async commentUrl => {
      try {
        await updateObjectIfNeeded(commentUrl, bodyValidator, updater, deleter)
      } catch (err) {
        logger.warn('Cannot update/delete remote AP comment %s.', commentUrl, { err })
      }
    }, { concurrency: AP_CLEANER_CONCURRENCY })
  }
}

// ---------------------------------------------------------------------------

export {
  processActivityPubCleaner
}

// ---------------------------------------------------------------------------

async function updateObjectIfNeeded <T> (
  url: string,
  bodyValidator: (body: any) => boolean,
  updater: (url: string, newUrl: string) => Promise<T>,
  deleter: (url: string) => Promise<T>
): Promise<{ data: T, status: 'deleted' | 'updated' } | null> {
  const on404OrTombstone = async () => {
    logger.info('Removing remote AP object %s.', url)
    const data = await deleter(url)

    return { status: 'deleted' as 'deleted', data }
  }

  try {
    const { body } = await doJSONRequest<any>(url, { activityPub: true })

    // If not same id, check same host and update
    if (!body || !body.id || !bodyValidator(body)) throw new Error(`Body or body id of ${url} is invalid`)

    if (body.type === 'Tombstone') {
      return on404OrTombstone()
    }

    const newUrl = body.id
    if (newUrl !== url) {
      if (checkUrlsSameHost(newUrl, url) !== true) {
        throw new Error(`New url ${newUrl} has not the same host than old url ${url}`)
      }

      logger.info('Updating remote AP object %s.', url)
      const data = await updater(url, newUrl)

      return { status: 'updated', data }
    }

    return null
  } catch (err) {
    // Does not exist anymore, remove entry
    if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
      return on404OrTombstone()
    }

    throw err
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
      const comment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideo(url)
      comment.url = newUrl

      await comment.save()

      return undefined
    },

    deleter: async (url) => {
      const comment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideo(url)

      await comment.destroy()

      return undefined
    }
  }
}
