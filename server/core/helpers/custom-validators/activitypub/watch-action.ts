import { arrayify } from '@peertube/peertube-core-utils'
import { WatchActionObject } from '@peertube/peertube-models'
import { isDateValid, isUUIDValid } from '../misc.js'
import { isVideoTimeValid } from '../video-view.js'
import { isActivityPubVideoDurationValid, isObjectValid } from './misc.js'

function isWatchActionObjectValid (action: WatchActionObject) {
  if (!action || action.type !== 'WatchAction') return false

  // TODO: compat with < 6.1, remove in 8.0
  if (!action.uuid && action['identifier']) action.uuid = action['identifier']

  if (action['_:actionStatus'] && !action.actionStatus) action.actionStatus = action['_:actionStatus']
  if (action['_:watchSections'] && !action.watchSections) action.watchSections = arrayify(action['_:watchSections'])

  return isObjectValid(action.id) &&
    isActivityPubVideoDurationValid(action.duration) &&
    isDateValid(action.startTime) &&
    isDateValid(action.endTime) &&
    isLocationValid(action.location) &&
    isUUIDValid(action.uuid) &&
    isObjectValid(action.object) &&
    areWatchSectionsValid(action.watchSections)
}

// ---------------------------------------------------------------------------

export {
  isWatchActionObjectValid
}

// ---------------------------------------------------------------------------

function isLocationValid (location: any) {
  if (!location) return true
  if (typeof location !== 'object') return false

  if (location.addressCountry && typeof location.addressCountry !== 'string') return false
  if (location.addressRegion && typeof location.addressRegion !== 'string') return false

  return true
}

function areWatchSectionsValid (sections: WatchActionObject['watchSections']) {
  return Array.isArray(sections) && sections.every(s => {
    // TODO: compat with < 6.1, remove in 8.0
    if (s['_:endTimestamp'] && !s.endTimestamp) s.endTimestamp = s['_:endTimestamp']

    return isVideoTimeValid(s.startTimestamp) && isVideoTimeValid(s.endTimestamp)
  })
}
