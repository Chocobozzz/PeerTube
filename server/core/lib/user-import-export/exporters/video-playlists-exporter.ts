import { VideoPlaylistsExportJSON } from '@peertube/peertube-models'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { MThumbnail, MVideoPlaylist } from '@server/types/models/index.js'
import { createReadStream } from 'fs'
import { extname, join } from 'path'
import { AbstractUserExporter, ExportResult } from './abstract-user-exporter.js'

export class VideoPlaylistsExporter extends AbstractUserExporter<VideoPlaylistsExportJSON> {
  async export () {
    const playlistsJSON: VideoPlaylistsExportJSON['videoPlaylists'] = []
    const staticFiles: ExportResult<VideoPlaylistsExportJSON>['staticFiles'] = []

    const playlists = await VideoPlaylistModel.listPlaylistForExport(this.user.Account.id)

    for (const playlist of playlists) {
      const elements = await VideoPlaylistElementModel.listElementsForExport(playlist.id)

      const archiveFiles = {
        thumbnail: null as string
      }

      if (playlist.hasThumbnail()) {
        const thumbnail = playlist.Thumbnail

        staticFiles.push({
          archivePath: this.getArchiveThumbnailPath(playlist, thumbnail),
          readStreamFactory: () => Promise.resolve(createReadStream(thumbnail.getFSPath()))
        })

        archiveFiles.thumbnail = join(this.relativeStaticDirPath, this.getArchiveThumbnailPath(playlist, thumbnail))
      }

      playlistsJSON.push({
        displayName: playlist.name,
        description: playlist.description,
        privacy: playlist.privacy,
        url: playlist.url,
        uuid: playlist.uuid,

        type: playlist.type,

        channel: {
          name: playlist.VideoChannel?.Actor?.preferredUsername
        },

        createdAt: playlist.createdAt.toISOString(),
        updatedAt: playlist.updatedAt.toISOString(),

        thumbnailUrl: playlist.Thumbnail?.getLocalFileUrl(),

        elements: elements.map(e => ({
          videoUrl: e.Video.url,
          startTimestamp: e.startTimestamp,
          stopTimestamp: e.stopTimestamp
        })),

        archiveFiles
      })
    }

    return {
      json: {
        videoPlaylists: playlistsJSON
      },

      staticFiles
    }
  }

  private getArchiveThumbnailPath (playlist: MVideoPlaylist, thumbnail: MThumbnail) {
    return join('thumbnails', playlist.uuid + extname(thumbnail.filename))
  }
}
