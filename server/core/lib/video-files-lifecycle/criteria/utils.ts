import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoStatModel } from '@server/models/stat/video-stat.js'

const logger = createLogger('video-files-lifecycle')

export function buildISODateFromDaysAgo (days: number) {
  return new Date(Date.now() - days * 86400000).toISOString()
}

// View based criteria rely on `videoStat` rows
// So refuse a policy window wider than the view stats retention or videos would wrongly look like they have no view
// We know it's not a ideal check, because a config change doesn't change the database state
export function checkViewStatsRetention (criterionType: string, days: number) {
  const maxAge = CONFIG.VIEWS.VIDEOS.LOCAL.MAX_AGE
  if (maxAge <= 0) return

  if (days * 86400000 > maxAge) {
    throw new Error(
      `Video files lifecycle criterion "${criterionType}" uses a ${days} days window, ` +
        `but views.videos.local.max_age removes local view stats before that. ` +
        `You must decrease the criterion window.`
    )
  }
}

// The retention check above only validates the current configuration
// But a shorter `max_age` in the past already removed the rows the criterion needs and PeerTube cannot rebuild them
export async function checkViewStatsAvailability (criterionType: string, days: number) {
  const oldest = await VideoStatModel.getOldestLocalStatDate()
  if (!oldest) return

  const availableMs = Date.now() - new Date(oldest).getTime()
  if (availableMs >= days * 86400000) return

  logger.warn(
    `Video files lifecycle criterion "${criterionType}" uses a ${days} days window, ` +
      `but the oldest local view stat of this instance is only ${Math.floor(availableMs / 86400000)} days old. ` +
      `Videos that were only viewed before that look like they have no view, so they may be processed by the policy.`
  )
}
