import { Transaction } from 'sequelize'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer'
import { LocalVideoViewerWatchSectionModel } from '@server/models/view/local-video-viewer-watch-section'
import { MVideo } from '@server/types/models'
import { WatchActionObject } from '@shared/models'
import { getDurationFromActivityStream } from './activity'

async function createOrUpdateLocalVideoViewer (watchAction: WatchActionObject, video: MVideo, t: Transaction) {
  const stats = await LocalVideoViewerModel.loadByUrl(watchAction.id)
  if (stats) await stats.destroy({ transaction: t })

  const localVideoViewer = await LocalVideoViewerModel.create({
    url: watchAction.id,
    uuid: watchAction.uuid,

    watchTime: getDurationFromActivityStream(watchAction.duration),

    startDate: new Date(watchAction.startTime),
    endDate: new Date(watchAction.endTime),

    country: watchAction.location
      ? watchAction.location.addressCountry
      : null,

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
