import { WatchActionObject } from '@peertube/peertube-models'
import { MAX_LOCAL_VIEWER_WATCH_SECTIONS } from '@server/initializers/constants.js'
import { isDateValid, isUUIDValid } from '../misc.js'
import { isVideoTimeValid } from '../video-view.js'
import { isActivityPubVideoDurationValid, isObjectValid } from './misc.js'

function isWatchActionObjectValid (action: WatchActionObject) {
  if (action?.type !== 'WatchAction') return false

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
  // Each section is stored as a row, and PeerTube never sends more sections than its local viewers can have
  return Array.isArray(sections) &&
    sections.length <= MAX_LOCAL_VIEWER_WATCH_SECTIONS &&
    sections.every(s => {
      return isVideoTimeValid(s?.startTimestamp) && isVideoTimeValid(s?.endTimestamp)
    })
}
