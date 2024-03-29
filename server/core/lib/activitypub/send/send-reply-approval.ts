import { ActivityApproveReply, ActivityRejectReply } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { MCommentOwnerVideoReply } from '../../../types/models/index.js'
import { getLocalApproveReplyActivityPubUrl } from '../url.js'
import { unicastTo } from './shared/send-utils.js'

// We can support type: 'RejectReply' in the future
export function sendReplyApproval (comment: MCommentOwnerVideoReply, type: 'ApproveReply') {
  logger.info('Creating job to approve reply %s.', comment.url)

  const data = buildApprovalActivity({ comment, type })

  return unicastTo({
    data,
    byActor: comment.Video.VideoChannel.Account.Actor,
    toActorUrl: comment.Account.Actor.inboxUrl,
    contextType: type
  })
}

export function buildApprovalActivity (options: {
  comment: MCommentOwnerVideoReply
  type: 'ApproveReply'
}): ActivityApproveReply | ActivityRejectReply {
  const { comment, type } = options

  return {
    type,
    id: type === 'ApproveReply'
      ? getLocalApproveReplyActivityPubUrl(comment.Video, comment)
      : undefined, // 'RejectReply' Not implemented yet
    actor: comment.Video.VideoChannel.Account.Actor.url,
    inReplyTo: comment.InReplyToVideoComment?.url ?? comment.Video.url,
    object: comment.url
  }
}
