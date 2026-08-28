import { uniqify } from '@peertube/peertube-core-utils'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { getActionHandler, getActionTypes } from './actions/actions.js'
import { getCriterionHandler, getCriterionTypes } from './criteria/criteria.js'

const logger = createLogger('video-files-lifecycle')

export function checkVideoFilesLifecycleConfig () {
  const lifecycle = CONFIG.VIDEO_FILE.LIFECYCLE
  if (lifecycle.ENABLED !== true) return

  if (!isArray(lifecycle.POLICIES)) {
    throw new Error('Video files lifecycle policies should be an array (you must uncomment lines containing - too)')
  }

  if (!Number.isInteger(lifecycle.MAX_VIDEOS_PER_RUN) || lifecycle.MAX_VIDEOS_PER_RUN <= 0) {
    throw new Error(`video_file.lifecycle.max_videos_per_run must be a positive integer instead of ${lifecycle.MAX_VIDEOS_PER_RUN}`)
  }

  if (lifecycle.POLICIES.length === 0) {
    logger.warn('Video files lifecycle is enabled but no policy is configured, so PeerTube has nothing to do.')
    return
  }

  for (const policy of lifecycle.POLICIES) {
    if (!policy || typeof policy !== 'object') {
      throw new Error('A video files lifecycle policy must be an object (you must uncomment all its lines)')
    }

    if (!policy.name || typeof policy.name !== 'string') {
      throw new Error('A video files lifecycle policy must have a name')
    }
  }

  const names = lifecycle.POLICIES.map(p => p.name)
  if (uniqify(names).length !== names.length) {
    throw new Error('Video files lifecycle policies should have unique names')
  }

  for (const policy of lifecycle.POLICIES) {
    const prefix = `Video files lifecycle policy "${policy.name}"`

    if (!isArray(policy.criteria) || policy.criteria.length === 0) {
      throw new Error(`${prefix} must have at least one criterion (you must uncomment lines containing - too)`)
    }

    for (const criterion of policy.criteria) {
      const handler = getCriterionHandler(criterion)

      if (!handler) {
        throw new Error(
          `${prefix} has an unknown criterion type "${criterion?.type}". Available criteria: ${getCriterionTypes().join(', ')}`
        )
      }

      try {
        handler.validate(criterion)
      } catch (err) {
        throw new Error(`${prefix} has an invalid criterion: ${err.message}`, { cause: err })
      }
    }

    const actionHandler = getActionHandler(policy.action)

    if (!actionHandler) {
      throw new Error(
        `${prefix} has an unknown action type "${policy.action?.type}". Available actions: ${getActionTypes().join(', ')}`
      )
    }

    try {
      actionHandler.validate(policy.action)
    } catch (err) {
      throw new Error(`${prefix} has an invalid action: ${err.message}`, { cause: err })
    }
  }
}
