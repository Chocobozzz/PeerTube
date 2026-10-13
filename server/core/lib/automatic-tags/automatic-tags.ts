import { AutomaticTagPolicyType, AutomaticTagsModeration, BuildObjectAutomaticTagsPayload } from '@peertube/peertube-models'
import { afterCommitIfTransaction, retryTransactionWrapper, runTransaction } from '@server/helpers/database-utils.js'
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
  MCommentId,
  MCommentVideo,
  MVideo,
  MVideoAutomaticTagWithTag,
  MVideoId
} from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { CreateJobOptions, CreateJobTypeAndPayload, JobQueue } from '../job-queue/job-queue.js'
import { AutomaticTagger } from './automatic-tagger.js'

export async function setAndSaveCommentAutomaticTags (options: {
  comment: MComment
  automaticTagsByAccount: Record<number, string[]>
}) {
  const { comment, automaticTagsByAccount } = options
  if (Object.keys(automaticTagsByAccount).length === 0) return

  const { toCreateItems, toDeleteItems } = await _buildAutomaticTagItems({
    automaticTagsByAccount,
    existingAutomaticTagsGetter: (accountIds: number[]) => {
      return CommentAutomaticTagModel.listByAccountIdsAndCommentId({ commentId: comment.id, accountIds })
    }
  })

  for (const item of toDeleteItems) {
    await item.destroy()
  }

  const commentAutomaticTags: MCommentAutomaticTagWithTag[] = []

  for (const tag of toCreateItems) {
    const automaticTagInstance = await AutomaticTagModel.findOrCreateAutomaticTag({ tag: tag.name })

    const [ commentAutomaticTag ] = await CommentAutomaticTagModel.upsert({
      accountId: tag.accountId,
      automaticTagId: automaticTagInstance.id,
      commentId: comment.id
    })

    commentAutomaticTag.AutomaticTag = automaticTagInstance

    commentAutomaticTags.push(commentAutomaticTag)
  }

  ;(comment as MCommentAdminOrUserFormattable).CommentAutomaticTags = commentAutomaticTags
}

export async function setAndSaveVideoAutomaticTags (options: {
  video: Pick<MVideo, 'id'>
  automaticTagsByAccount: Record<number, string[]>
}) {
  const { video, automaticTagsByAccount } = options

  if (Object.keys(automaticTagsByAccount).length === 0) return

  await retryTransactionWrapper(() => {
    return runTransaction(async transaction => {
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
    })
  })
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

// ---------------------------------------------------------------------------
// Automatic tags are built by the `build-object-automatic-tags` job so plugin auto taggers never run inside a
// transaction and are allowed to take a long time (they may analyze the video files or call an external service)
// ---------------------------------------------------------------------------

export async function buildAndSaveVideoAutomaticTags (options: {
  video: Pick<MVideo, 'id' | 'name' | 'description'>
}) {
  const { video } = options

  const automaticTagsByAccount = await new AutomaticTagger().buildVideoAutomaticTags({
    serverAccount: await getServerAccount(),
    video
  })

  await setAndSaveVideoAutomaticTags({ video, automaticTagsByAccount })

  return automaticTagsByAccount
}

export async function buildAndSaveCommentAutomaticTags (options: {
  comment: MCommentVideo
  ofServerAccount?: boolean // default true
  ofOwnerAccount?: boolean // default true
}) {
  const { comment, ofServerAccount = true, ofOwnerAccount = true } = options

  const automaticTagsByAccount = await new AutomaticTagger().buildCommentsAutomaticTags({
    serverAccount: ofServerAccount
      ? await getServerAccount()
      : null,
    ownerAccount: ofOwnerAccount
      ? comment.Video.VideoChannel.Account
      : null,
    text: comment.text
  })

  await setAndSaveCommentAutomaticTags({ comment, automaticTagsByAccount })

  return automaticTagsByAccount
}

// ---------------------------------------------------------------------------

export function createVideoAutomaticTagsJob (options: {
  video: MVideoId
  moderation: AutomaticTagsModeration
  transaction?: Transaction
}) {
  const { video, moderation, transaction } = options

  createBuildObjectAutomaticTagsJob({
    payload: { objectType: 'video', objectId: video.id, moderation, notify: null },
    transaction
  })
}

// Same job, but returned instead of created so the caller can insert it in a job flow
// We can't use a deduplicated job in a job flow
export function buildNonDuplicatedVideoAutomaticTagsJob (options: {
  video: MVideoId
  moderation: AutomaticTagsModeration
}): CreateJobTypeAndPayload & CreateJobOptions {
  const { video, moderation } = options

  return {
    type: 'build-object-automatic-tags',
    payload: { objectType: 'video', objectId: video.id, moderation, notify: null }
  }
}

export function createCommentAutomaticTagsJob (options: {
  comment: MCommentId
  moderation: AutomaticTagsModeration
  notify: boolean
  transaction?: Transaction
}) {
  const { comment, moderation, notify, transaction } = options

  createBuildObjectAutomaticTagsJob({
    payload: { objectType: 'comment', objectId: comment.id, moderation, notify },
    transaction
  })
}

function createBuildObjectAutomaticTagsJob (options: {
  payload: BuildObjectAutomaticTagsPayload
  transaction?: Transaction
}) {
  const { payload, transaction } = options

  afterCommitIfTransaction(transaction, () => {
    JobQueue.Instance.createJobAsync({
      type: 'build-object-automatic-tags',
      payload,

      ...buildAutomaticTagsJobDeduplication(payload)
    })
  })
}

function buildAutomaticTagsJobDeduplication (options: Pick<BuildObjectAutomaticTagsPayload, 'objectType' | 'objectId'>) {
  return {
    deduplicationId: `build-object-automatic-tags-${options.objectType}-${options.objectId}`,
    deduplicationKeepLastIfActive: true
  }
}
