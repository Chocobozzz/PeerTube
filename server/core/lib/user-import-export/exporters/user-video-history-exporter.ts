import { UserVideoHistoryExportJSON } from '@peertube/peertube-models'
import { AbstractUserExporter } from './abstract-user-exporter.js'
import { UserVideoHistoryModel } from '@server/models/user/user-video-history.js'

export class UserVideoHistoryExporter extends AbstractUserExporter <UserVideoHistoryExportJSON> {

  async export () {
    const videos = await UserVideoHistoryModel.listForExport(this.user)

    return {
      json: {
        watchedVideos: videos.map(v => ({
          videoUrl: v.videoUrl,
          lastTimecode: v.currentTime,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString()
        }))
      } as UserVideoHistoryExportJSON,

      staticFiles: []
    }
  }
}
