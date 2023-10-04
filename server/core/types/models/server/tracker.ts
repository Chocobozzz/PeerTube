import { TrackerModel } from '../../../models/server/tracker.js'

export type MTracker = Omit<TrackerModel, 'Videos'>

// ############################################################################

export type MTrackerUrl = Pick<MTracker, 'url'>
