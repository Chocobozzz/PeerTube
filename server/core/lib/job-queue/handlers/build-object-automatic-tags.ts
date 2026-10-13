import { BuildObjectAutomaticTagsPayload } from '@peertube/peertube-models'
import { afterCommitIfTransaction, retryTransactionWrapper, runTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { buildAndSaveCommentAutomaticTags, buildAndSaveVideoAutomaticTags } from '@server/lib/automatic-tags/automatic-tags.js'
import { Notifier } from '@server/lib/notifier/index.js'
import { autoBlacklistVideoByAutoTagPolicyIfNeeded, resolvePendingAutoTagBlacklist } from '@server/lib/video-blacklist.js'
import { approveComment, getCommentHoldStatus } from '@server/lib/video-comment.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoModel } from '@server/models/video/video.js'
import { Job } from 'bullmq'

const logger = createLogger('job-queue')

// Auto taggers of plugins can be slow (they may analyze the video files or call an external service)
// Automatic tags of a video/comment are always built here and never in a transaction
export async function processBuildObjectAutomaticTags (job: Job): Promise<void> {
  const payload = job.data as BuildObjectAutomaticTagsPayload

  logger.info('Processing build automatic tags of %s %d in job %s.', payload.objectType, payload.objectId, job.id)

  if (payload.objectType === 'video') await buildOfVideo(payload)
  else await buildOfComment(payload)

  logger.info('Processed build automatic tags of %s %d in job %s.', payload.objectType, payload.objectId, job.id)
}

// ---------------------------------------------------------------------------

async function buildOfVideo (payload: BuildObjectAutomaticTagsPayload) {
  // Auto taggers only need the id/name/description: plugins load/analyze anything else (files included) themselves
  const video = await VideoModel.load(payload.objectId)
  if (!video) {
    logger.info('Do not build automatic tags of video %d that does not exist anymore.', payload.objectId)
    return
  }

  const automaticTagsByAccount = await buildAndSaveVideoAutomaticTags({ video })

  if (payload.moderation === 'none') return

  // Building the tags can take a long time: reload the video and apply the moderation decision against its current
  // state, all in a single retried transaction
  await retryTransactionWrapper(() =>
    runTransaction(async t => {
      const videoReloaded = await VideoModel.loadWithRights(payload.objectId, t)
      if (!videoReloaded) return

      if (payload.moderation === 'apply') {
        const user = await UserModel.loadByAccountId(videoReloaded.VideoChannel.accountId, t)

        await autoBlacklistVideoByAutoTagPolicyIfNeeded({ video: videoReloaded, user, automaticTagsByAccount, transaction: t })
      } else {
        await resolvePendingAutoTagBlacklist({ video: videoReloaded, automaticTagsByAccount, transaction: t })
      }
    })
  )
}

async function buildOfComment (payload: BuildObjectAutomaticTagsPayload) {
  const comment = await VideoCommentModel.loadByIdWithVideo(payload.objectId)
  if (!comment || comment.isDeleted()) {
    logger.info('Do not build automatic tags of comment %d that does not exist anymore.', payload.objectId)
    return
  }

  const automaticTagsByAccount = await buildAndSaveCommentAutomaticTags({ comment })

  // A comment is federated as soon as it is created, so it is only held while waiting for its tags
  if (payload.moderation !== 'release-hold') return

  // Building the tags can take a long time: reload the comment and apply the moderation decision against its current
  // state (a moderator may already have approved/rejected it), all in a single retried transaction
  await retryTransactionWrapper(() =>
    runTransaction(async t => {
      const commentReloaded = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(payload.objectId, t)
      if (!commentReloaded || commentReloaded.isDeleted()) return

      if (commentReloaded.heldForReview) {
        const video = commentReloaded.Video

        const holdStatus = await getCommentHoldStatus({
          user: commentReloaded.accountId
            ? await UserModel.loadByAccountId(commentReloaded.accountId, t)
            : null,
          video,
          holdIfAutoTagPolicy: false,
          ownerAutomaticTags: automaticTagsByAccount[video.VideoChannel.accountId],
          transaction: t
        })

        if (holdStatus === 'not-held') {
          // The comment was only held while waiting for its automatic tags: its author must not be notified of an approval
          await approveComment(commentReloaded, { notify: false, transaction: t })
          commentReloaded.heldForReview = false

          logger.info('Comment %d released from review: its automatic tags do not match any review policy.', commentReloaded.id)
        }
      }

      // The video owner has not been notified at creation, because the held status of the comment was not final yet
      // Notify it even if the comment is still held for review, so it can approve it
      // `notify` is false for a comment that only exists to complete a federated thread (see `resolveThread`)
      if (payload.notify !== false) {
        afterCommitIfTransaction(t, () => Notifier.Instance.notifyOnNewComment(commentReloaded))
      }
    })
  )
}
