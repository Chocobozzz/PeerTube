import { Transaction } from 'sequelize/types'
import { buildRemoteVideoBaseUrl } from '@server/helpers/activitypub'
import { isAPVideoTrackerUrlObject } from '@server/helpers/custom-validators/activitypub/videos'
import { isArray } from '@server/helpers/custom-validators/misc'
import { REMOTE_SCHEME } from '@server/initializers/constants'
import { TrackerModel } from '@server/models/server/tracker'
import { MVideo, MVideoWithHost } from '@server/types/models'
import { ActivityTrackerUrlObject, VideoObject } from '@shared/models'

function getTrackerUrls (object: VideoObject, video: MVideoWithHost) {
  let wsFound = false

  const trackers = object.url.filter(u => isAPVideoTrackerUrlObject(u))
    .map((u: ActivityTrackerUrlObject) => {
      if (isArray(u.rel) && u.rel.includes('websocket')) wsFound = true

      return u.href
    })

  if (wsFound) return trackers

  return [
    buildRemoteVideoBaseUrl(video, '/tracker/socket', REMOTE_SCHEME.WS),
    buildRemoteVideoBaseUrl(video, '/tracker/announce')
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
