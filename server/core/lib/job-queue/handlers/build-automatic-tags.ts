import { BuildAutomaticTagsPayload } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { buildAndSaveCommentAutomaticTags, buildAndSaveVideoAutomaticTags } from '@server/lib/automatic-tags/automatic-tags.js'
import { getServerAccount } from '@server/models/application/application.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoModel } from '@server/models/video/video.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { Job } from 'bullmq'

const logger = createLogger('job-queue')

const BATCH_SIZE = 250

export async function processBuildAutomaticTags (job: Job): Promise<void> {
  const payload = job.data as BuildAutomaticTagsPayload

  logger.info('Processing build automatic tags in job %s.', job.id, { payload })

  const serverAccount = await getServerAccount()
  const accountId = payload.accountId

  // Ensure watched words cache is up to date (race condition with updates on other processes)
  // An admin can update the watched words on a secondary and this task is executed on the primary
  WatchedWordsListModel.clearLocalRegexCache(accountId)

  let totalRebuiltComments = 0
  let totalRebuiltVideos = 0

  const isServerAccount = accountId === serverAccount.id

  if (payload.ofComments) {
    const rebuiltComments = await rebuildComments({
      videoOwnerId: isServerAccount
        ? null
        : accountId,
      isServerAccount
    })
    totalRebuiltComments += rebuiltComments
  }

  if (payload.ofVideos) {
    if (!isServerAccount) throw new Error('Cannot process video automatic tags for a non-server account.')

    const rebuiltVideos = await rebuildVideos()
    totalRebuiltVideos += rebuiltVideos
  }

  logger.info('Processed build automatic tags in job %s.', job.id, {
    payload,
    rebuiltComments: totalRebuiltComments,
    rebuiltVideos: totalRebuiltVideos
  })
}

async function rebuildComments (options: {
  videoOwnerId: number
  isServerAccount: boolean
}) {
  const { videoOwnerId, isServerAccount } = options

  let rebuilt = 0
  let lastId = 0

  while (true) {
    const ids = await VideoCommentModel.batchListIds({ videoOwnerId, deleted: false, batchSize: BATCH_SIZE, lastId })
    if (ids.length === 0) break

    lastId = ids[ids.length - 1]

    for (const id of ids) {
      const comment = await VideoCommentModel.loadByIdWithVideo(id)
      if (!comment) continue

      // Only the account this job runs for changed its watched words/policies: leave the tags of the other account alone
      await buildAndSaveCommentAutomaticTags({
        comment,
        ofServerAccount: isServerAccount,
        ofOwnerAccount: !isServerAccount
      })

      rebuilt++
    }
  }

  return rebuilt
}

async function rebuildVideos () {
  let rebuilt = 0
  let lastId = 0

  while (true) {
    const ids = await VideoModel.batchListIds({ lastId, batchSize: BATCH_SIZE })
    if (ids.length === 0) break

    lastId = ids[ids.length - 1]

    for (const id of ids) {
      const video = await VideoModel.load(id)
      if (!video) continue

      await buildAndSaveVideoAutomaticTags({ video })

      rebuilt++
    }
  }

  return rebuilt
}
