import { ActivityApproveReply, ActivityRejectReply, ActivityType } from '@peertube/peertube-models'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MCommentOwnerVideoReply } from '../../../types/models/index.js'
import { sendCreateVideoCommentIfNeeded } from '../send/send-create.js'

export function processReplyApprovalFactory (type: Extract<ActivityType, 'ApproveReply' | 'RejectReply'>) {
  return async (options: APProcessorOptions<ActivityApproveReply | ActivityRejectReply>) => {
    if (type === 'RejectReply') return // Not yet implemented

    const { activity, byActor } = options
    const comment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(activity.object)

    if (!comment || comment.isDeleted()) {
      throw new Error(`Cannot process reply approval on comment ${comment.url} that doesn't exist`)
    }

    if (comment.isOwned() !== true) {
      throw new Error(`Cannot process reply approval on non-owned comment ${comment.url}`)
    }

    if (byActor.id !== comment.Video.VideoChannel.Account.Actor.id) {
      throw new Error(`Cannot process reply approval on ${comment.url} by non video owner`)
    }

    return processApproveReply(activity.id, comment)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function processApproveReply (replyApproval: string, comment: MCommentOwnerVideoReply) {
  if (comment.heldForReview === false || comment.replyApproval === replyApproval) return

  return sequelizeTypescript.transaction(async t => {
    comment.heldForReview = false
    comment.replyApproval = replyApproval
    await comment.save({ transaction: t })

    await sendCreateVideoCommentIfNeeded(comment, t)
  })
}
