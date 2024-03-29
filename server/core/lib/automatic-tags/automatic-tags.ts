import { AutomaticTagPolicyType } from '@peertube/peertube-models'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'
import { AutomaticTagModel } from '@server/models/automatic-tag/automatic-tag.js'
import { CommentAutomaticTagModel } from '@server/models/automatic-tag/comment-automatic-tag.js'
import { VideoAutomaticTagModel } from '@server/models/automatic-tag/video-automatic-tag.js'
import {
  MAccountId,
  MComment,
  MCommentAdminOrUserFormattable,
  MCommentAutomaticTagWithTag,
  MVideo,
  MVideoAutomaticTagWithTag
} from '@server/types/models/index.js'
import { Transaction } from 'sequelize'

export async function setAndSaveCommentAutomaticTags (options: {
  comment: MComment
  automaticTags: { accountId: number, name: string }[]
  transaction?: Transaction
}) {
  const { comment, automaticTags, transaction } = options

  if (automaticTags.length === 0) return

  const commentAutomaticTags: MCommentAutomaticTagWithTag[] = []

  const accountIds = new Set(automaticTags.map(t => t.accountId))
  for (const accountId of accountIds) {
    await CommentAutomaticTagModel.deleteAllOfAccountAndComment({ accountId, commentId: comment.id, transaction })
  }

  for (const tag of automaticTags) {
    const automaticTagInstance = await AutomaticTagModel.findOrCreateAutomaticTag({ tag: tag.name, transaction })

    const [ commentAutomaticTag ] = await CommentAutomaticTagModel.upsert({
      accountId: tag.accountId,
      automaticTagId: automaticTagInstance.id,
      commentId: comment.id
    }, { transaction })

    commentAutomaticTag.AutomaticTag = automaticTagInstance

    commentAutomaticTags.push(commentAutomaticTag)
  }

  (comment as MCommentAdminOrUserFormattable).CommentAutomaticTags = commentAutomaticTags
}

export async function setAndSaveVideoAutomaticTags (options: {
  video: MVideo
  automaticTags: { accountId: number, name: string }[]
  transaction?: Transaction
}) {
  const { video, automaticTags, transaction } = options

  if (automaticTags.length === 0) return

  const accountIds = new Set(automaticTags.map(t => t.accountId))
  for (const accountId of accountIds) {
    await VideoAutomaticTagModel.deleteAllOfAccountAndVideo({ accountId, videoId: video.id, transaction })
  }

  const videoAutomaticTags: MVideoAutomaticTagWithTag[] = []

  for (const tag of automaticTags) {
    const automaticTagInstance = await AutomaticTagModel.findOrCreateAutomaticTag({ tag: tag.name, transaction })

    const [ videoAutomaticTag ] = await VideoAutomaticTagModel.upsert({
      accountId: tag.accountId,
      automaticTagId: automaticTagInstance.id,
      videoId: video.id
    }, { transaction })

    videoAutomaticTag.AutomaticTag = automaticTagInstance

    videoAutomaticTags.push(videoAutomaticTag)
  }
}

export async function setAccountAutomaticTagsPolicy (options: {
  account: MAccountId
  tags: string[]
  policy: AutomaticTagPolicyType
  transaction?: Transaction
}) {
  const { account, policy, tags, transaction } = options

  await AccountAutomaticTagPolicyModel.deleteOfAccount({ account, policy, transaction })

  for (const tag of tags) {
    const automaticTagInstance = await AutomaticTagModel.findOrCreateAutomaticTag({ tag, transaction })

    await AccountAutomaticTagPolicyModel.create({
      policy,
      accountId: account.id,
      automaticTagId: automaticTagInstance.id
    }, { transaction })
  }
}
