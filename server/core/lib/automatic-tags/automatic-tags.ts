import { AutomaticTagPolicyType } from '@peertube/peertube-models'
import { getServerAccount } from '@server/models/application/application.js'
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
import { JobQueue } from '../job-queue/job-queue.js'

export async function setAndSaveCommentAutomaticTags (options: {
  comment: MComment
  automaticTagsByAccount: Record<number, string[]>
  transaction?: Transaction
}) {
  const { comment, automaticTagsByAccount, transaction } = options

  const { toCreateItems, toDeleteItems } = await _buildAutomaticTagItems({
    automaticTagsByAccount,
    existingAutomaticTagsGetter: (accountIds: number[]) => {
      return CommentAutomaticTagModel.listByAccountIdsAndCommentId({ commentId: comment.id, accountIds, transaction })
    }
  })

  for (const item of toDeleteItems) {
    await item.destroy({ transaction })
  }

  const commentAutomaticTags: MCommentAutomaticTagWithTag[] = []

  for (const tag of toCreateItems) {
    const automaticTagInstance = await AutomaticTagModel.findOrCreateAutomaticTag({ tag: tag.name, transaction })

    const [ commentAutomaticTag ] = await CommentAutomaticTagModel.upsert({
      accountId: tag.accountId,
      automaticTagId: automaticTagInstance.id,
      commentId: comment.id
    }, { transaction })

    commentAutomaticTag.AutomaticTag = automaticTagInstance

    commentAutomaticTags.push(commentAutomaticTag)
  }

  ;(comment as MCommentAdminOrUserFormattable).CommentAutomaticTags = commentAutomaticTags
}

export async function setAndSaveVideoAutomaticTags (options: {
  video: MVideo
  automaticTagsByAccount: Record<number, string[]>
  transaction?: Transaction
}) {
  const { video, automaticTagsByAccount, transaction } = options

  const { toCreateItems, toDeleteItems } = await _buildAutomaticTagItems({
    automaticTagsByAccount,

    existingAutomaticTagsGetter: accountIds => {
      return VideoAutomaticTagModel.listByAccountIdsAndVideoId({ videoId: video.id, accountIds, transaction })
    }
  })

  for (const item of toDeleteItems) {
    await item.destroy({ transaction })
  }

  const videoAutomaticTags: MVideoAutomaticTagWithTag[] = []

  for (const tag of toCreateItems) {
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

async function _buildAutomaticTagItems<T extends MCommentAutomaticTagWithTag | MVideoAutomaticTagWithTag> (options: {
  automaticTagsByAccount: Record<number, string[]>
  existingAutomaticTagsGetter: (accountIds: number[]) => Promise<T[]>
}) {
  const { automaticTagsByAccount, existingAutomaticTagsGetter } = options

  const accountIds = Object.keys(automaticTagsByAccount).map(id => Number(id))

  // Convert automaticTagsByAccount to a flat list of { accountId, name }
  const automaticTags: { accountId: number, name: string }[] = []
  for (const [ accountId, tags ] of Object.entries(automaticTagsByAccount)) {
    for (const tag of tags) {
      automaticTags.push({ accountId: Number(accountId), name: tag })
    }
  }

  const existingVideoAutomaticTags = await existingAutomaticTagsGetter(accountIds)

  const existingByKey = new Map(existingVideoAutomaticTags.map(tag => [ `${tag.accountId}:${tag.AutomaticTag.name}`, tag ]))
  const desiredKeys = new Set(automaticTags.map(tag => `${tag.accountId}:${tag.name}`))

  const toDeleteItems = existingVideoAutomaticTags
    .filter(tag => !desiredKeys.has(`${tag.accountId}:${tag.AutomaticTag.name}`))

  const toCreateItems = automaticTags.filter(tag => !existingByKey.has(`${tag.accountId}:${tag.name}`))

  return { toDeleteItems, toCreateItems }
}

// ---------------------------------------------------------------------------

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

export async function createRebuildAutomaticTagsJob (options: {
  accountId: number
}) {
  const { accountId } = options

  return JobQueue.Instance.createJob({
    type: 'build-automatic-tags',
    payload: {
      accountId,
      ofComments: true,
      ofVideos: (await getServerAccount()).id === accountId
    },
    deduplicationId: `build-automatic-tags:${accountId}`
  })
}
