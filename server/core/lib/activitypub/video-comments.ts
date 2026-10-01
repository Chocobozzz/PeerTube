import { HttpStatusCode, VideoCommentPolicy } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import Bluebird from 'bluebird'
import { sanitizeAndCheckVideoCommentObject } from '../../helpers/custom-validators/activitypub/video-comments.js'
import { createLogger } from '../../helpers/logger.js'
import { ACTIVITY_PUB, CRAWL_REQUEST_CONCURRENCY } from '../../initializers/constants.js'
import { VideoCommentModel } from '../../models/video/video-comment.js'
import {
  MComment,
  MCommentOwner,
  MCommentOwnerVideo,
  MVideoAccountLight,
  MVideoAccountLightBlacklistAllFiles
} from '../../types/models/video/index.js'
import { createCommentAutomaticTagsJob } from '../automatic-tags/automatic-tags.js'
import { isRemoteVideoCommentAccepted } from '../moderation.js'
import { Hooks } from '../plugins/hooks.js'
import { CommentHoldStatus, getCommentHoldStatus } from '../video-comment.js'
import { fetchAP } from './activity.js'
import { getOrCreateAPActor } from './actors/index.js'
import { checkUrlsSameHost } from './url.js'
import { canVideoBeFederated, getOrCreateAPVideo } from './videos/index.js'

const logger = createLogger()

type ResolveThreadParams = {
  url: string
  comments: MCommentOwner[]
  isVideo?: boolean
  commentCreated: boolean
}
type ResolveThreadResult = Promise<{
  video: MVideoAccountLightBlacklistAllFiles
  comment: MCommentOwnerVideo
  commentCreated: boolean
  heldForAutoTags: boolean
}>

export async function addVideoComments (commentUrls: string[]) {
  if (CONFIG.VIDEO_COMMENTS.ACCEPT_REMOTE_COMMENTS !== true) return

  return Bluebird.map(commentUrls, async commentUrl => {
    await logger.withContext([ commentUrl ], async () => {
      try {
        await resolveThread({ url: commentUrl, isVideo: false })
      } catch (err) {
        if (err.statusCode === HttpStatusCode.NOT_FOUND_404 || err.statusCode === HttpStatusCode.GONE_410) {
          logger.debug(`Cannot resolve thread ${commentUrl} that does not exist anymore`, { err })
          return
        }

        logger.info(`Cannot resolve thread ${commentUrl}`, { err })
      }
    })
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

// Resolves a full AP comment thread starting from `url`, walking up the `inReplyTo` chain until it hits
// either a comment already stored locally or the video the thread is attached to
export async function resolveThread (params: { url: string, isVideo?: boolean }): ResolveThreadResult {
  try {
    return await resolveThreadInternal({ ...params, comments: [], commentCreated: false })
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') throw err

    // Another activity (maybe processed by another process) created a comment of this thread at the same time
    // The next attempt finds it in database
    logger.debug('Cannot resolve thread %s because of a concurrent comment creation, retrying.', params.url, { err })

    return resolveThreadInternal({ ...params, comments: [], commentCreated: false })
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

// `params.comments` accumulates the chain: index 0 ends up being the comment `url` originally pointed to
// and the last index is the comment directly replying to the video (the thread root)
async function resolveThreadInternal (params: ResolveThreadParams): ResolveThreadResult {
  const { url, isVideo } = params

  // If it is not a video, or if we don't know if it's a video, try to get the thread from DB
  if (isVideo === false || isVideo === undefined) {
    const result = await resolveCommentFromDB(params)
    if (result) return result
  }

  try {
    // If it is a video, or if we don't know if it's a video
    if (isVideo === true || isVideo === undefined) {
      // Keep await so we catch the exception
      return await tryToResolveThreadFromVideo(params)
    }
  } catch (err) {
    logger.debug('Cannot resolve thread from video %s, maybe because it was not a video', url, { err })
  }

  return resolveRemoteParentComment(params)
}

async function resolveCommentFromDB (params: ResolveThreadParams) {
  const { url, comments, commentCreated } = params

  const commentFromDatabase = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(url)
  if (!commentFromDatabase) return undefined

  let parentComments = comments.concat([ commentFromDatabase ])

  // The rest of the thread above this comment is already in DB too: append it instead of re-fetching each ancestor from the remote instance
  if (commentFromDatabase.InReplyToVideoComment) {
    const data = await VideoCommentModel.listThreadParentComments({ comment: commentFromDatabase, order: 'DESC' })

    parentComments = parentComments.concat(data)
  }

  // We know the video already, so skip straight to it instead of walking inReplyTo comment by comment
  return resolveThreadInternal({
    url: commentFromDatabase.Video.url,
    comments: parentComments,
    isVideo: true,
    commentCreated
  })
}

// ---------------------------------------------------------------------------

// Once the video is reached the whole chain is known and gets persisted root-first
async function tryToResolveThreadFromVideo (params: ResolveThreadParams) {
  const { url, comments, commentCreated } = params

  // Maybe it's a reply to a video?
  // If yes, it's done: we resolved all the thread
  const syncParam = { rates: true, shares: true, comments: false, refreshVideo: false }
  const { video } = await getOrCreateAPVideo({ videoObject: url, syncParam })

  if (video.isLocal() && !canVideoBeFederated(video)) {
    throw new Error('Cannot resolve thread of video that is not compatible with federation')
  }

  if (video.commentsPolicy === VideoCommentPolicy.DISABLED) {
    return undefined
  }

  let resultComment: MCommentOwnerVideo
  // comments[0] is the comment the thread was resolved for: only its held status is reported back to the caller,
  // the other comments in the array are ancestors synthesized to complete the thread
  let resultCommentHeldForAutoTags = false

  if (comments.length !== 0) {
    // Process root-first (comments.length - 1 down to 0): each comment needs its parent's real DB id for
    // inReplyToCommentId/originCommentId, which only exists once the parent has been saved
    const firstReply = comments[comments.length - 1] as MCommentOwnerVideo
    firstReply.inReplyToCommentId = null
    firstReply.originCommentId = null
    firstReply.videoId = video.id
    firstReply.changed('updatedAt', true)
    firstReply.Video = video

    if (await isRemoteCommentAccepted(firstReply) !== true) {
      return undefined
    }

    const { isNew: firstReplyIsNew, holdStatus: firstReplyHoldStatus } = await assignReviewIfNew(firstReply, video)
    comments[comments.length - 1] = await firstReply.save()

    // New comment: process auto tags
    if (firstReplyIsNew) {
      if (comments.length === 1) resultCommentHeldForAutoTags = firstReplyHoldStatus === 'held-for-auto-tags'

      createCommentAutomaticTagsJob({
        comment: firstReply,
        moderation: firstReplyHoldStatus === 'held-for-auto-tags'
          ? 'release-hold'
          : 'none',
        // Only the comment the thread was resolved for (comments[0]) must notify the video owner: the other ones
        // are ancestors synthesized to complete the thread, not what the Create activity was actually about
        notify: comments.length === 1
      })
    }

    for (let i = comments.length - 2; i >= 0; i--) {
      const comment = comments[i] as MCommentOwnerVideo
      comment.originCommentId = firstReply.id
      comment.inReplyToCommentId = comments[i + 1].id
      comment.videoId = video.id
      comment.changed('updatedAt', true)
      comment.Video = video

      if (await isRemoteCommentAccepted(comment) !== true) {
        return undefined
      }

      const { isNew, holdStatus } = await assignReviewIfNew(comment, video)

      comments[i] = await comment.save()

      // New comment: process auto tags
      if (isNew) {
        if (i === 0) resultCommentHeldForAutoTags = holdStatus === 'held-for-auto-tags'

        createCommentAutomaticTagsJob({
          comment,
          moderation: holdStatus === 'held-for-auto-tags'
            ? 'release-hold'
            : 'none',
          // comments[0] is the comment the thread was resolved for: only it must notify the video owner
          notify: i === 0
        })
      }
    }

    resultComment = comments[0] as MCommentOwnerVideo
  }

  return { video, comment: resultComment, commentCreated, heldForAutoTags: resultCommentHeldForAutoTags }
}

// Assign the held for review status of the comment if it's a new one
// `holdStatus` is only set for a new comment: an existing one keeps the status it already has in database
// Automatic tags are built by a job, so a comment is held as soon as the account has a review policy
// The job then releases it if the tags it ends up with don't match any of them
async function assignReviewIfNew (comment: MComment, video: MVideoAccountLight): Promise<{
  isNew: boolean
  holdStatus?: CommentHoldStatus
}> {
  // Remote comment already exists in database -> we don't need to rebuild automatic tags
  if (comment.id) return { isNew: false }

  // Third parties rely on origin, so if origin has the comment it's not held for review
  const holdStatus: CommentHoldStatus = video.isLocal() || comment.isLocal()
    ? await getCommentHoldStatus({ user: null, video, holdIfAutoTagPolicy: true })
    : 'not-held'

  comment.heldForReview = holdStatus !== 'not-held'

  return { isNew: true, holdStatus }
}

// ---------------------------------------------------------------------------

// Despite the name, this also resolves the original leaf/target comment on the first call, not just
// its ancestors: it's the fallback once DB lookup and video resolution have both failed for `url`
async function resolveRemoteParentComment (params: ResolveThreadParams) {
  const { url, comments } = params

  // Guard against unbounded/malicious inReplyTo chains
  if (comments.length > ACTIVITY_PUB.MAX_RECURSION_COMMENTS) {
    throw new Error('Recursion limit reached when resolving a thread')
  }

  const { body } = await fetchAP<any>(url)

  if (sanitizeAndCheckVideoCommentObject(body) === false) {
    throw new Error(`Remote video comment JSON ${url} is not valid:` + JSON.stringify(body))
  }

  const actorUrl = body.attributedTo
  if (!actorUrl && body.type !== 'Tombstone') throw new Error('Miss attributed to in comment')

  // An actor hosted on another server can't author a comment on this one (identity spoofing guard)
  if (actorUrl && checkUrlsSameHost(url, actorUrl) !== true) {
    throw new Error(`Actor url ${actorUrl} has not the same host than the comment url ${url}`)
  }

  // The fetched object must claim an id on the same host it was fetched from
  if (checkUrlsSameHost(body.id, url) !== true) {
    throw new Error(`Comment url ${url} host is different from the AP object id ${body.id}`)
  }

  const actor = actorUrl
    ? await getOrCreateAPActor(actorUrl, 'all')
    : null

  const comment = new VideoCommentModel({
    url: body.id,
    text: body.content ? body.content : '',
    videoId: null,
    accountId: actor ? actor.Account.id : null,
    inReplyToCommentId: null,
    originCommentId: null,
    createdAt: new Date(body.published),
    updatedAt: new Date(body.updated),
    replyApproval: body.replyApproval,

    deletedAt: body.deleted
      ? new Date(body.deleted)
      : null
  }) as MCommentOwner
  comment.Account = actor ? actor.Account : null

  logger.debug('Created remote comment %s', comment.url, { comment })

  return resolveThreadInternal({
    url: body.inReplyTo,
    comments: comments.concat([ comment ]),
    commentCreated: true
  })
}

async function isRemoteCommentAccepted (comment: MComment) {
  // Already created
  if (comment.id) return true

  const acceptParameters = {
    comment
  }

  const acceptedResult = await Hooks.wrapFun(
    isRemoteVideoCommentAccepted,
    acceptParameters,
    'filter:activity-pub.remote-video-comment.create.accept.result'
  )

  if (acceptedResult?.accepted !== true) {
    logger.info('Refused to create a remote comment.', { acceptedResult, acceptParameters })

    return false
  }

  return true
}
