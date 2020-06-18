import { sanitizeAndCheckVideoCommentObject } from '../../helpers/custom-validators/activitypub/video-comments'
import { logger } from '../../helpers/logger'
import { doRequest } from '../../helpers/requests'
import { ACTIVITY_PUB, CRAWL_REQUEST_CONCURRENCY } from '../../initializers/constants'
import { VideoCommentModel } from '../../models/video/video-comment'
import { getOrCreateActorAndServerAndModel } from './actor'
import { getOrCreateVideoAndAccountAndChannel } from './videos'
import * as Bluebird from 'bluebird'
import { checkUrlsSameHost } from '../../helpers/activitypub'
import { MCommentOwner, MCommentOwnerVideo, MVideoAccountLightBlacklistAllFiles } from '../../types/models/video'

type ResolveThreadParams = {
  url: string
  comments?: MCommentOwner[]
  isVideo?: boolean
  commentCreated?: boolean
}
type ResolveThreadResult = Promise<{ video: MVideoAccountLightBlacklistAllFiles, comment: MCommentOwnerVideo, commentCreated: boolean }>

async function addVideoComments (commentUrls: string[]) {
  return Bluebird.map(commentUrls, commentUrl => {
    return resolveThread({ url: commentUrl, isVideo: false })
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

async function resolveThread (params: ResolveThreadParams): ResolveThreadResult {
  const { url, isVideo } = params
  if (params.commentCreated === undefined) params.commentCreated = false
  if (params.comments === undefined) params.comments = []

  // Already have this comment?
  if (isVideo !== true) {
    const result = await resolveCommentFromDB(params)
    if (result) return result
  }

  try {
    if (isVideo !== false) return await tryResolveThreadFromVideo(params)

    return resolveParentComment(params)
  } catch (err) {
    logger.debug('Cannot get or create account and video and channel for reply %s, fetch comment', url, { err })

    return resolveParentComment(params)
  }
}

export {
  addVideoComments,
  resolveThread
}

// ---------------------------------------------------------------------------

async function resolveCommentFromDB (params: ResolveThreadParams) {
  const { url, comments, commentCreated } = params

  const commentFromDatabase = await VideoCommentModel.loadByUrlAndPopulateReplyAndVideoUrlAndAccount(url)
  if (commentFromDatabase) {
    let parentComments = comments.concat([ commentFromDatabase ])

    // Speed up things and resolve directly the thread
    if (commentFromDatabase.InReplyToVideoComment) {
      const data = await VideoCommentModel.listThreadParentComments(commentFromDatabase, undefined, 'DESC')

      parentComments = parentComments.concat(data)
    }

    return resolveThread({
      url: commentFromDatabase.Video.url,
      comments: parentComments,
      isVideo: true,
      commentCreated
    })
  }

  return undefined
}

async function tryResolveThreadFromVideo (params: ResolveThreadParams) {
  const { url, comments, commentCreated } = params

  // Maybe it's a reply to a video?
  // If yes, it's done: we resolved all the thread
  const syncParam = { likes: true, dislikes: true, shares: true, comments: false, thumbnail: true, refreshVideo: false }
  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: url, syncParam })

  let resultComment: MCommentOwnerVideo
  if (comments.length !== 0) {
    const firstReply = comments[comments.length - 1] as MCommentOwnerVideo
    firstReply.inReplyToCommentId = null
    firstReply.originCommentId = null
    firstReply.videoId = video.id
    firstReply.changed('updatedAt', true)
    firstReply.Video = video

    comments[comments.length - 1] = await firstReply.save()

    for (let i = comments.length - 2; i >= 0; i--) {
      const comment = comments[i] as MCommentOwnerVideo
      comment.originCommentId = firstReply.id
      comment.inReplyToCommentId = comments[i + 1].id
      comment.videoId = video.id
      comment.changed('updatedAt', true)
      comment.Video = video

      comments[i] = await comment.save()
    }

    resultComment = comments[0] as MCommentOwnerVideo
  }

  return { video, comment: resultComment, commentCreated }
}

async function resolveParentComment (params: ResolveThreadParams) {
  const { url, comments } = params

  if (comments.length > ACTIVITY_PUB.MAX_RECURSION_COMMENTS) {
    throw new Error('Recursion limit reached when resolving a thread')
  }

  const { body } = await doRequest<any>({
    uri: url,
    json: true,
    activityPub: true
  })

  if (sanitizeAndCheckVideoCommentObject(body) === false) {
    throw new Error('Remote video comment JSON is not valid:' + JSON.stringify(body))
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
    ? await getOrCreateActorAndServerAndModel(actorUrl, 'all')
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
    deletedAt: body.deleted ? new Date(body.deleted) : null
  }) as MCommentOwner
  comment.Account = actor ? actor.Account : null

  return resolveThread({
    url: body.inReplyTo,
    comments: comments.concat([ comment ]),
    commentCreated: true
  })
}
