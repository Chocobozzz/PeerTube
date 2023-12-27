import { Transaction } from 'sequelize'
import { isAPVideoTrackerUrlObject } from '@server/helpers/custom-validators/activitypub/videos.js'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { REMOTE_SCHEME } from '@server/initializers/constants.js'
import { TrackerModel } from '@server/models/server/tracker.js'
import { MVideo, MVideoWithHost } from '@server/types/models/index.js'
import { ActivityTrackerUrlObject, VideoObject } from '@peertube/peertube-models'
import { buildRemoteUrl } from '../../url.js'

function getTrackerUrls (object: VideoObject, video: MVideoWithHost) {
  let wsFound = false

  const trackers = object.url.filter(u => isAPVideoTrackerUrlObject(u))
    .map((u: ActivityTrackerUrlObject) => {
      if (isArray(u.rel) && u.rel.includes('websocket')) wsFound = true

      return u.href
    })

  if (wsFound) return trackers

  return [
    buildRemoteUrl(video, '/tracker/socket', REMOTE_SCHEME.WS),
    buildRemoteUrl(video, '/tracker/announce')
  ]
}

async function setVideoTrackers (options: {
  video: MVideo
  trackers: string[]
  transaction: Transaction
}) {
  const { video, trackers, transaction } = options

  const trackerInstances = await TrackerModel.findOrCreateTrackers(trackers, transaction)

  await video.$set('Trackers', trackerInstances, { transaction })
}

export {
  getTrackerUrls,
  setVideoTrackers
}
