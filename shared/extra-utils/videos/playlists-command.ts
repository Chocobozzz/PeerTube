import { omit, pick } from 'lodash'
import {
  BooleanBothQuery,
  ResultList,
  VideoExistInPlaylist,
  VideoPlaylist,
  VideoPlaylistCreateResult,
  VideoPlaylistElement,
  VideoPlaylistElementCreateResult,
  VideoPlaylistReorder
} from '@shared/models'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { VideoPlaylistCreate } from '../../models/videos/playlist/video-playlist-create.model'
import { VideoPlaylistElementCreate } from '../../models/videos/playlist/video-playlist-element-create.model'
import { VideoPlaylistElementUpdate } from '../../models/videos/playlist/video-playlist-element-update.model'
import { VideoPlaylistType } from '../../models/videos/playlist/video-playlist-type.model'
import { VideoPlaylistUpdate } from '../../models/videos/playlist/video-playlist-update.model'
import { unwrapBody } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'
import { videoUUIDToId } from './videos'

export class PlaylistsCommand extends AbstractCommand {

  list (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
  }) {
    const path = '/api/v1/video-playlists'
    const query = pick(options, [ 'start', 'count', 'sort' ])

    return this.getRequestBody<ResultList<VideoPlaylist>>({
      ...options,

      path,
      query,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listByChannel (options: OverrideCommandOptions & {
    handle: string
    start?: number
    count?: number
    sort?: string
  }) {
    const path = '/api/v1/video-channels/' + options.handle + '/video-playlists'
    const query = pick(options, [ 'start', 'count', 'sort' ])

    return this.getRequestBody<ResultList<VideoPlaylist>>({
      ...options,

      path,
      query,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listByAccount (options: OverrideCommandOptions & {
    handle: string
    start?: number
    count?: number
    sort?: string
    search?: string
    playlistType?: VideoPlaylistType
  }) {
    const path = '/api/v1/accounts/' + options.handle + '/video-playlists'
    const query = pick(options, [ 'start', 'count', 'sort', 'search', 'playlistType' ])

    return this.getRequestBody<ResultList<VideoPlaylist>>({
      ...options,

      path,
      query,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  get (options: OverrideCommandOptions & {
    playlistId: number | string
  }) {
    const { playlistId } = options
    const path = '/api/v1/video-playlists/' + playlistId

    return this.getRequestBody<VideoPlaylist>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listVideos (options: OverrideCommandOptions & {
    playlistId: number | string
    start?: number
    count?: number
    query?: { nsfw?: BooleanBothQuery }
  }) {
    const path = '/api/v1/video-playlists/' + options.playlistId + '/videos'
    const query = options.query ?? {}

    return this.getRequestBody<ResultList<VideoPlaylistElement>>({
      ...options,

      path,
      query: {
        ...query,
        start: options.start,
        count: options.count
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  delete (options: OverrideCommandOptions & {
    playlistId: number | string
  }) {
    const path = '/api/v1/video-playlists/' + options.playlistId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async create (options: OverrideCommandOptions & {
    attributes: VideoPlaylistCreate
  }) {
    const path = '/api/v1/video-playlists'

    const fields = omit(options.attributes, 'thumbnailfile')

    const attaches = options.attributes.thumbnailfile
      ? { thumbnailfile: options.attributes.thumbnailfile }
      : {}

    const body = await unwrapBody<{ videoPlaylist: VideoPlaylistCreateResult }>(this.postUploadRequest({
      ...options,

      path,
      fields,
      attaches,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    return body.videoPlaylist
  }

  update (options: OverrideCommandOptions & {
    attributes: VideoPlaylistUpdate
    playlistId: number | string
  }) {
    const path = '/api/v1/video-playlists/' + options.playlistId

    const fields = omit(options.attributes, 'thumbnailfile')

    const attaches = options.attributes.thumbnailfile
      ? { thumbnailfile: options.attributes.thumbnailfile }
      : {}

    return this.putUploadRequest({
      ...options,

      path,
      fields,
      attaches,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async addElement (options: OverrideCommandOptions & {
    playlistId: number | string
    attributes: VideoPlaylistElementCreate | { videoId: string }
  }) {
    const attributes = {
      ...options.attributes,

      videoId: await videoUUIDToId(this.server.url, options.attributes.videoId)
    }

    const path = '/api/v1/video-playlists/' + options.playlistId + '/videos'

    const body = await unwrapBody<{ videoPlaylistElement: VideoPlaylistElementCreateResult }>(this.postBodyRequest({
      ...options,

      path,
      fields: attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    return body.videoPlaylistElement
  }

  updateElement (options: OverrideCommandOptions & {
    playlistId: number | string
    elementId: number | string
    attributes: VideoPlaylistElementUpdate
  }) {
    const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/' + options.elementId

    return this.putBodyRequest({
      ...options,

      path,
      fields: options.attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeElement (options: OverrideCommandOptions & {
    playlistId: number | string
    elementId: number
  }) {
    const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/' + options.elementId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  reorderElements (options: OverrideCommandOptions & {
    playlistId: number | string
    attributes: VideoPlaylistReorder
  }) {
    const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/reorder'

    return this.postBodyRequest({
      ...options,

      path,
      fields: options.attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  getPrivacies (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/video-playlists/privacies'

    return this.getRequestBody<{ [ id: number ]: string }>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  videosExist (options: OverrideCommandOptions & {
    videoIds: number[]
  }) {
    const { videoIds } = options
    const path = '/api/v1/users/me/video-playlists/videos-exist'

    return this.getRequestBody<VideoExistInPlaylist>({
      ...options,

      path,
      query: { videoIds },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
