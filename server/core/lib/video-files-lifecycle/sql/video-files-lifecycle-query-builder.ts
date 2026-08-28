import { VideoLifecyclePolicy, VideoState } from '@peertube/peertube-models'
import { AbstractRunQuery } from '@server/models/shared/index.js'
import { getActionHandler } from '../actions/actions.js'
import { getCriterionHandler } from '../criteria/criteria.js'

/**
 * List the local videos a video files lifecycle policy must be applied on
 */

export class VideoFilesLifecycleQueryBuilder extends AbstractRunQuery {
  async listVideosToProcess (options: {
    policy: VideoLifecyclePolicy
    limit: number

    // Restrict the query to a specific video, to re-check it still matches the policy
    videoId?: number
  }) {
    const { policy, limit, videoId } = options

    const where: string[] = [
      // We only own the files of our videos
      `"video"."remote" IS FALSE`,

      // Files of a live are handled by the live manager
      `"video"."isLive" IS FALSE`,

      // Don't interfere with a video that is being transcoded, moved, imported or edited
      `"video"."state" = :lifecyclePublishedState`,
      `NOT EXISTS (` +
      `  SELECT 1 FROM "videoJobInfo" ` +
      `  WHERE "videoJobInfo"."videoId" = "video"."id" ` +
      `  AND ("videoJobInfo"."pendingTranscode" > 0 OR "videoJobInfo"."pendingMove" > 0)` +
      `)`,

      // A blacklisted video may be unblacklisted by a moderator, so keep its files intact
      `NOT EXISTS (SELECT 1 FROM "videoBlacklist" WHERE "videoBlacklist"."videoId" = "video"."id")`
    ]

    if (videoId) {
      where.push(`"video"."id" = :lifecycleVideoId`)
      this.replacements.lifecycleVideoId = videoId
    }

    this.replacements.lifecyclePublishedState = VideoState.PUBLISHED
    this.replacements.limit = limit

    for (let i = 0; i < policy.criteria.length; i++) {
      const criterion = policy.criteria[i]
      const built = getCriterionHandler(criterion).buildWhereToProcess(criterion, i)

      where.push(`(${built.sql})`)
      Object.assign(this.replacements, built.replacements)
    }

    const builtAction = getActionHandler(policy.action).buildWhereForUnprocessed(policy.action)
    where.push(`(${builtAction.sql})`)
    Object.assign(this.replacements, builtAction.replacements)

    this.query = `SELECT "video"."id", "video"."uuid" FROM "video" ` +
      `WHERE ${where.join(' AND ')} ORDER BY "video"."id" ASC LIMIT :limit`

    const rows = await this.runQuery()

    return rows.map(r => ({ id: r.id as number, uuid: r.uuid as string }))
  }
}
