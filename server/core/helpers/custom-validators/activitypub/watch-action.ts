import { WatchActionObject } from '@peertube/peertube-models'
import { exists, isDateValid, isUUIDValid } from '../misc.js'
import { isVideoTimeValid } from '../video-view.js'
import { isActivityPubVideoDurationValid, isObjectValid } from './misc.js'

function isWatchActionObjectValid (action: WatchActionObject) {
  return exists(action) &&
    action.type === 'WatchAction' &&
    isObjectValid(action.id) &&
    isActivityPubVideoDurationValid(action.duration) &&
    isDateValid(action.startTime) &&
    isDateValid(action.endTime) &&
    isLocationValid(action.location) &&
    isUUIDValid(action.uuid) &&
    isObjectValid(action.object) &&
    isWatchSectionsValid(action.watchSections)
}

// ---------------------------------------------------------------------------

export {
  isWatchActionObjectValid
}

// ---------------------------------------------------------------------------

function isLocationValid (location: any) {
  if (!location) return true

  return typeof location === 'object' && typeof location.addressCountry === 'string'
}

function isWatchSectionsValid (sections: WatchActionObject['watchSections']) {
  return Array.isArray(sections) && sections.every(s => {
    return isVideoTimeValid(s.startTimestamp) && isVideoTimeValid(s.endTimestamp)
  })
}
