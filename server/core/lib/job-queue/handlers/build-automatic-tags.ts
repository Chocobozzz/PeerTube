import { BuildAutomaticTagsPayload } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { AutomaticTagger } from '@server/lib/automatic-tags/automatic-tagger.js'
import { setAndSaveCommentAutomaticTags, setAndSaveVideoAutomaticTags } from '@server/lib/automatic-tags/automatic-tags.js'
import { getServerAccount } from '@server/models/application/application.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoModel } from '@server/models/video/video.js'
import { MAccount } from '@server/types/models/index.js'
import { Job } from 'bullmq'

const lTags = loggerTagsFactory('job-queue')

const BATCH_SIZE = 250

export async function processBuildAutomaticTags (job: Job): Promise<void> {
  const payload = job.data as BuildAutomaticTagsPayload

  logger.info('Processing build automatic tags in job %s.', job.id, { payload, ...lTags() })

  const serverAccount = await getServerAccount()
  const accountId = payload.accountId

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
    rebuiltVideos: totalRebuiltVideos,
    ...lTags()
  })
}

async function rebuildComments (options: {
  videoOwnerId: number
  isServerAccount: boolean
}) {
  const { videoOwnerId, isServerAccount } = options

  const automaticTagger = new AutomaticTagger()

  let rebuilt = 0
  let lastId = 0

  while (true) {
    const ids = await VideoCommentModel.batchListIds({ videoOwnerId, deleted: false, batchSize: BATCH_SIZE, lastId })
    if (ids.length === 0) break

    lastId = ids[ids.length - 1]

    for (const id of ids) {
      const comment = await VideoCommentModel.loadByIdWithVideo(id)

      let serverAccount: MAccount
      let ownerAccount: MAccount

      if (isServerAccount) serverAccount = await getServerAccount()
      else ownerAccount = comment.Video.VideoChannel.Account

      const automaticTagsByAccount = await automaticTagger.buildCommentsAutomaticTags({ text: comment.text, serverAccount, ownerAccount })

      await setAndSaveCommentAutomaticTags({ comment, automaticTagsByAccount })

      rebuilt++
    }
  }

  return rebuilt
}

async function rebuildVideos () {
  const automaticTagger = new AutomaticTagger()

  let rebuilt = 0
  let lastId = 0

  while (true) {
    const ids = await VideoModel.batchListIds({ lastId, batchSize: BATCH_SIZE })
    if (ids.length === 0) break

    lastId = ids[ids.length - 1]

    for (const id of ids) {
      const video = await VideoModel.load(id)

      const automaticTagsByAccount = await automaticTagger.buildVideoAutomaticTags({ video, serverAccount: await getServerAccount() })

      await setAndSaveVideoAutomaticTags({ video, automaticTagsByAccount })

      rebuilt++
    }
  }

  return rebuilt
}
