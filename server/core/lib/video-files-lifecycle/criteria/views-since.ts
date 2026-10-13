import { VideoLifecycleViewsSinceCriterion } from '@peertube/peertube-models'
import { LifecycleCriterionHandler } from './criterion.model.js'
import { buildISODateFromDaysAgo, checkViewStatsAvailability, checkViewStatsRetention } from './utils.js'

export const viewsSinceCriterion: LifecycleCriterionHandler<VideoLifecycleViewsSinceCriterion> = {
  validate (criterion) {
    if (!Number.isInteger(criterion.days) || criterion.days <= 0) {
      throw new Error(`"days" of "views-since" criterion must be a positive integer instead of ${criterion.days}`)
    }

    if (!Number.isInteger(criterion.count) || criterion.count < 0) {
      throw new Error(`"count" of "views-since" criterion must be a positive integer instead of ${criterion.count}`)
    }

    const operators = [ 'lte', 'gte' ]
    if (operators.includes(criterion.operator) === false) {
      throw new Error(`"operator" of "views-since" criterion must be ${operators.join(' or ')} instead of ${criterion.operator}`)
    }

    checkViewStatsRetention(criterion.type, criterion.days)
  },

  checkDatabaseState (criterion) {
    return checkViewStatsAvailability(criterion.type, criterion.days)
  },

  buildWhereToProcess (criterion, index) {
    const minViewsDate = `viewsSinceDate${index}`
    const viewsCount = `viewsSinceCount${index}`

    // A downloaded video is a used video, so count downloads as views
    const views = `COALESCE((` +
      `  SELECT SUM("videoStat"."views" + "videoStat"."downloads") FROM "videoStat" ` +
      `  WHERE "videoStat"."videoId" = "video"."id" AND "videoStat"."startDate" > :${minViewsDate}` +
      `), 0)`

    const operator = criterion.operator === 'lte'
      ? '<='
      : '>='

    const conditions = [ `${views} ${operator} :${viewsCount}` ]

    // A video published inside the window did not have the time to reach the view count,
    // so don't consider it doesn't have enough views
    if (criterion.operator === 'lte') conditions.push(`"video"."publishedAt" < :${minViewsDate}`)

    return {
      sql: conditions.join(' AND '),
      replacements: {
        [minViewsDate]: buildISODateFromDaysAgo(criterion.days),
        [viewsCount]: criterion.count
      }
    }
  }
}
