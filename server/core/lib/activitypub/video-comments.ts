import { VideoCommentPolicy } from '@peertube/peertube-models'
import Bluebird from 'bluebird'
import { sanitizeAndCheckVideoCommentObject } from '../../helpers/custom-validators/activitypub/video-comments.js'
import { logger } from '../../helpers/logger.js'
import { ACTIVITY_PUB, CRAWL_REQUEST_CONCURRENCY } from '../../initializers/constants.js'
import { VideoCommentModel } from '../../models/video/video-comment.js'
import {
  MComment,
  MCommentOwner,
  MCommentOwnerVideo,
  MVideoAccountLight,
  MVideoAccountLightBlacklistAllFiles
} from '../../types/models/video/index.js'
import { AutomaticTagger } from '../automatic-tags/automatic-tagger.js'
import { setAndSaveCommentAutomaticTags } from '../automatic-tags/automatic-tags.js'
import { isRemoteVideoCommentAccepted } from '../moderation.js'
import { Hooks } from '../plugins/hooks.js'
import { shouldCommentBeHeldForReview } from '../video-comment.js'
import { fetchAP } from './activity.js'
import { getOrCreateAPActor } from './actors/index.js'
import { checkUrlsSameHost } from './url.js'
import { canVideoBeFederated, getOrCreateAPVideo } from './videos/index.js'

type ResolveThreadParams = {
  url: string
  comments?: MCommentOwner[]
  isVideo?: boolean
  commentCreated?: boolean
}
type ResolveThreadResult = Promise<{ video: MVideoAccountLightBlacklistAllFiles, comment: MCommentOwnerVideo, commentCreated: boolean }>

export async function addVideoComments (commentUrls: string[]) {
  return Bluebird.map(commentUrls, async commentUrl => {
    try {
      await resolveThread({ url: commentUrl, isVideo: false })
    } catch (err) {
      logger.warn('Cannot resolve thread %s.', commentUrl, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

export async function resolveThread (params: ResolveThreadParams): ResolveThreadResult {
  const { url, isVideo } = params

  if (params.commentCreated === undefined) params.commentCreated = false
  if (params.comments === undefined) params.comments = []

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

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function resolveCommentFromDB (params: ResolveThreadParams) {
  const { url, comments, commentCreated } = params

  const commentFromDatabase = await VideoCommentModel.loadByUrlAndPopulateReplyAndVideoImmutableAndAccount(url)
  if (!commentFromDatabase) return undefined

  let parentComments = comments.concat([ commentFromDatabase ])

  // Speed up things and resolve directly the thread
  if (commentFromDatabase.InReplyToVideoComment) {
    const data = await VideoCommentModel.listThreadParentComments({ comment: commentFromDatabase, order: 'DESC' })

    parentComments = parentComments.concat(data)
  }

  return resolveThread({
    url: commentFromDatabase.Video.url,
    comments: parentComments,
    isVideo: true,
    commentCreated
  })
}

// ---------------------------------------------------------------------------

async function tryToResolveThreadFromVideo (params: ResolveThreadParams) {
  const { url, comments, commentCreated } = params

  // Maybe it's a reply to a video?
  // If yes, it's done: we resolved all the thread
  const syncParam = { rates: true, shares: true, comments: false, refreshVideo: false }
  const { video } = await getOrCreateAPVideo({ videoObject: url, syncParam })

  if (video.isOwned() && !canVideoBeFederated(video)) {
    throw new Error('Cannot resolve thread of video that is not compatible with federation')
  }

  if (video.commentsPolicy === VideoCommentPolicy.DISABLED) {
    return undefined
  }

  let resultComment: MCommentOwnerVideo
  if (comments.length !== 0) {
    const firstReply = comments[comments.length - 1] as MCommentOwnerVideo
    firstReply.inReplyToCommentId = null
    firstReply.originCommentId = null
    firstReply.videoId = video.id
    firstReply.changed('updatedAt', true)
    firstReply.Video = video

    if (await isRemoteCommentAccepted(firstReply) !== true) {
      return undefined
    }

    const firstReplyAutomaticTags = await getAutomaticTagsAndAssignReview(firstReply, video)
    comments[comments.length - 1] = await firstReply.save()

    await setAndSaveCommentAutomaticTags({ comment: firstReply, automaticTags: firstReplyAutomaticTags })

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

      const automaticTags = await getAutomaticTagsAndAssignReview(comment, video)

      comments[i] = await comment.save()

      await setAndSaveCommentAutomaticTags({ comment, automaticTags })
    }

    resultComment = comments[0] as MCommentOwnerVideo
  }

  return { video, comment: resultComment, commentCreated }
}

async function getAutomaticTagsAndAssignReview (comment: MComment, video: MVideoAccountLight) {
  // Remote comment already exists in database or remote video -> we don't need to rebuild automatic tags
  if (comment.id) return []

  const ownerAccount = video.VideoChannel.Account

  const automaticTags = await new AutomaticTagger().buildCommentsAutomaticTags({ ownerAccount, text: comment.text })

  // Third parties rely on origin, so if origin has the comment it's not held for review
  if (video.isOwned() || comment.isOwned()) {
    comment.heldForReview = await shouldCommentBeHeldForReview({ user: null, video, automaticTags })
  } else {
    comment.heldForReview = false
  }

  return automaticTags
}

// ---------------------------------------------------------------------------

async function resolveRemoteParentComment (params: ResolveThreadParams) {
  const { url, comments } = params

  if (comments.length > ACTIVITY_PUB.MAX_RECURSION_COMMENTS) {
    throw new Error('Recursion limit reached when resolving a thread')
  }

  const { body } = await fetchAP<any>(url)

  if (sanitizeAndCheckVideoCommentObject(body) === false) {
    throw new Error(`Remote video comment JSON ${url} is not valid:` + JSON.stringify(body))
  }

  const actorUrl = body.attributedTo
  if (!actorUrl && body.type !== 'Tombstone') throw new Error('Miss attributed to in comment')

  if (actorUrl && checkUrlsSameHost(url, actorUrl) !== true) {
    throw new Error(`Actor url ${actorUrl} has not the same host than the comment url ${url}`)
  }

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

  return resolveThread({
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

  if (!acceptedResult || acceptedResult.accepted !== true) {
    logger.info('Refused to create a remote comment.', { acceptedResult, acceptParameters })

    return false
  }

  return true
}
