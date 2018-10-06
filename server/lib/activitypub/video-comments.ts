import { VideoCommentObject } from '../../../shared/models/activitypub/objects/video-comment-object'
import { sanitizeAndCheckVideoCommentObject } from '../../helpers/custom-validators/activitypub/video-comments'
import { logger } from '../../helpers/logger'
import { doRequest } from '../../helpers/requests'
import { ACTIVITY_PUB, CRAWL_REQUEST_CONCURRENCY } from '../../initializers'
import { ActorModel } from '../../models/activitypub/actor'
import { VideoModel } from '../../models/video/video'
import { VideoCommentModel } from '../../models/video/video-comment'
import { getOrCreateActorAndServerAndModel } from './actor'
import { getOrCreateVideoAndAccountAndChannel } from './videos'
import * as Bluebird from 'bluebird'

async function videoCommentActivityObjectToDBAttributes (video: VideoModel, actor: ActorModel, comment: VideoCommentObject) {
  let originCommentId: number = null
  let inReplyToCommentId: number = null

  // If this is not a reply to the video (thread), create or get the parent comment
  if (video.url !== comment.inReplyTo) {
    const { comment: parent } = await addVideoComment(video, comment.inReplyTo)
    if (!parent) {
      logger.warn('Cannot fetch or get parent comment %s of comment %s.', comment.inReplyTo, comment.id)
      return undefined
    }

    originCommentId = parent.originCommentId || parent.id
    inReplyToCommentId = parent.id
  }

  return {
    url: comment.id,
    text: comment.content,
    videoId: video.id,
    accountId: actor.Account.id,
    inReplyToCommentId,
    originCommentId,
    createdAt: new Date(comment.published),
    updatedAt: new Date(comment.updated)
  }
}

async function addVideoComments (commentUrls: string[], instance: VideoModel) {
  return Bluebird.map(commentUrls, commentUrl => {
    return addVideoComment(instance, commentUrl)
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

async function addVideoComment (videoInstance: VideoModel, commentUrl: string) {
  logger.info('Fetching remote video comment %s.', commentUrl)

  const { body } = await doRequest({
    uri: commentUrl,
    json: true,
    activityPub: true
  })

  if (sanitizeAndCheckVideoCommentObject(body) === false) {
    logger.debug('Remote video comment JSON is not valid.', { body })
    return { created: false }
  }

  const actorUrl = body.attributedTo
  if (!actorUrl) return { created: false }

  const actor = await getOrCreateActorAndServerAndModel(actorUrl)
  const entry = await videoCommentActivityObjectToDBAttributes(videoInstance, actor, body)
  if (!entry) return { created: false }

  const [ comment, created ] = await VideoCommentModel.findOrCreate({
    where: {
      url: body.id
    },
    defaults: entry
  })

  return { comment, created }
}

async function resolveThread (url: string, comments: VideoCommentModel[] = []) {
   // Already have this comment?
  const commentFromDatabase = await VideoCommentModel.loadByUrlAndPopulateReplyAndVideo(url)
  if (commentFromDatabase) {
    let parentComments = comments.concat([ commentFromDatabase ])

    // Speed up things and resolve directly the thread
    if (commentFromDatabase.InReplyToVideoComment) {
      const data = await VideoCommentModel.listThreadParentComments(commentFromDatabase, undefined, 'DESC')

      parentComments = parentComments.concat(data)
    }

    return resolveThread(commentFromDatabase.Video.url, parentComments)
  }

  try {
    // Maybe it's a reply to a video?
    // If yes, it's done: we resolved all the thread
    const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: url })

    if (comments.length !== 0) {
      const firstReply = comments[ comments.length - 1 ]
      firstReply.inReplyToCommentId = null
      firstReply.originCommentId = null
      firstReply.videoId = video.id
      comments[comments.length - 1] = await firstReply.save()

      for (let i = comments.length - 2; i >= 0; i--) {
        const comment = comments[ i ]
        comment.originCommentId = firstReply.id
        comment.inReplyToCommentId = comments[ i + 1 ].id
        comment.videoId = video.id

        comments[i] = await comment.save()
      }
    }

    return { video, parents: comments }
  } catch (err) {
    logger.debug('Cannot get or create account and video and channel for reply %s, fetch comment', url, { err })

    if (comments.length > ACTIVITY_PUB.MAX_RECURSION_COMMENTS) {
      throw new Error('Recursion limit reached when resolving a thread')
    }

    const { body } = await doRequest({
      uri: url,
      json: true,
      activityPub: true
    })

    if (sanitizeAndCheckVideoCommentObject(body) === false) {
      throw new Error('Remote video comment JSON is not valid :' + JSON.stringify(body))
    }

    const actorUrl = body.attributedTo
    if (!actorUrl) throw new Error('Miss attributed to in comment')

    const actor = await getOrCreateActorAndServerAndModel(actorUrl)
    const comment = new VideoCommentModel({
      url: body.id,
      text: body.content,
      videoId: null,
      accountId: actor.Account.id,
      inReplyToCommentId: null,
      originCommentId: null,
      createdAt: new Date(body.published),
      updatedAt: new Date(body.updated)
    })

    return resolveThread(body.inReplyTo, comments.concat([ comment ]))
  }

}

export {
  videoCommentActivityObjectToDBAttributes,
  addVideoComments,
  addVideoComment,
  resolveThread
}
