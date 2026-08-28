import { VideoLifecyclePolicy } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFull } from '@server/types/models/index.js'
import { getActionHandler } from './actions/actions.js'
import { getCriterionHandler } from './criteria/criteria.js'
import { VideoFilesLifecycleQueryBuilder } from './sql/video-files-lifecycle-query-builder.js'

const logger = createLogger('video-files-lifecycle')

export function getVideoFilesLifecyclePolicy (name: string) {
  return CONFIG.VIDEO_FILE.LIFECYCLE.POLICIES.find(p => p.name === name)
}

export function listVideosToProcess (options: {
  policy: VideoLifecyclePolicy
  limit: number
}) {
  const builder = new VideoFilesLifecycleQueryBuilder(VideoModel.sequelize)

  return builder.listVideosToProcess(options)
}

// Warn the admin when the database doesn't contain the data the criteria of the policy need
export async function checkPolicyDatabaseState (policy: VideoLifecyclePolicy) {
  for (const criterion of policy.criteria) {
    await getCriterionHandler(criterion).checkDatabaseState?.(criterion)
  }
}

// The video may have been viewed, transcoded, moved or blacklisted since the scheduler selected it
export async function doesVideoStillMatchPolicy (options: {
  policy: VideoLifecyclePolicy
  videoId: number
}) {
  const { policy, videoId } = options

  const builder = new VideoFilesLifecycleQueryBuilder(VideoModel.sequelize)
  const rows = await builder.listVideosToProcess({ policy, videoId, limit: 1 })

  return rows.length === 1
}

export async function applyVideoFilesLifecyclePolicy (options: {
  policy: VideoLifecyclePolicy
  video: MVideoFull

  // Log what the action would do, without deleting any file
  dryRun: boolean
}) {
  const { policy, video, dryRun } = options

  const handler = getActionHandler(policy.action)
  const description = handler.describe(policy.action)

  if (dryRun) {
    const result = handler.simulate(video, policy.action)

    logger.info(
      `Dry run of video files lifecycle policy "${policy.name}" on video ${video.uuid}: ` +
        `would ${description} (${result.files} files).`,
      result
    )

    return result
  }

  const result = await handler.apply(video, policy.action)

  logger.info(
    `Applied video files lifecycle policy "${policy.name}" (${description}) on video ${video.uuid}: ` +
      `${result.files} files.`,
    result
  )

  return result
}
