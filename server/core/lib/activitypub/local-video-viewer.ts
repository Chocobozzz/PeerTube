import { Transaction } from 'sequelize'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import { LocalVideoViewerWatchSectionModel } from '@server/models/view/local-video-viewer-watch-section.js'
import { MVideo } from '@server/types/models/index.js'
import { WatchActionObject } from '@peertube/peertube-models'
import { getDurationFromActivityStream } from './activity.js'

async function createOrUpdateLocalVideoViewer (watchAction: WatchActionObject, video: MVideo, t: Transaction) {
  const stats = await LocalVideoViewerModel.loadByUrl(watchAction.id)
  if (stats) await stats.destroy({ transaction: t })

  const localVideoViewer = await LocalVideoViewerModel.create({
    url: watchAction.id,
    uuid: watchAction.uuid,

    watchTime: getDurationFromActivityStream(watchAction.duration),

    startDate: new Date(watchAction.startTime),
    endDate: new Date(watchAction.endTime),

    country: watchAction.location?.addressCountry || null,
    subdivisionName: watchAction.location?.addressRegion || null,

    videoId: video.id
  }, { transaction: t })

  await LocalVideoViewerWatchSectionModel.bulkCreateSections({
    localVideoViewerId: localVideoViewer.id,

    watchSections: watchAction.watchSections.map(s => ({
      start: s.startTimestamp,
      end: s.endTimestamp
    })),

    transaction: t
  })
}

// ---------------------------------------------------------------------------

export {
  createOrUpdateLocalVideoViewer
}
