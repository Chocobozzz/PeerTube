import {
  HttpStatusCode,
  ResultList,
  Video,
  VideoChannel,
  VideoChannelsSearchQuery,
  VideoPlaylist,
  VideoPlaylistsSearchQuery,
  VideosSearchQuery
} from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class SearchCommand extends AbstractCommand {
  searchChannels (
    options: OverrideCommandOptions & {
      search: string
    }
  ) {
    return this.advancedChannelSearch({
      ...options,

      search: { search: options.search }
    })
  }

  advancedChannelSearch (
    options: OverrideCommandOptions & {
      search: VideoChannelsSearchQuery
    }
  ) {
    const { search } = options
    const path = '/api/v1/search/video-channels'

    return this.getRequestBody<ResultList<VideoChannel>>({
      ...options,

      path,
      query: search,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  searchPlaylists (
    options: OverrideCommandOptions & {
      search: string
    }
  ) {
    return this.advancedPlaylistSearch({
      ...options,

      search: { search: options.search }
    })
  }

  advancedPlaylistSearch (
    options: OverrideCommandOptions & {
      search: VideoPlaylistsSearchQuery
    }
  ) {
    const { search } = options
    const path = '/api/v1/search/video-playlists'

    return this.getRequestBody<ResultList<VideoPlaylist>>({
      ...options,

      path,
      query: search,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  searchVideos (
    options: OverrideCommandOptions & {
      search?: string
      sort?: string
    }
  ) {
    const { search, sort } = options

    return this.advancedVideoSearch({
      ...options,

      search: {
        search,
        sort: sort ?? '-publishedAt'
      }
    })
  }

  advancedVideoSearch (
    options: OverrideCommandOptions & {
      search?: VideosSearchQuery
    }
  ) {
    const { search } = options
    const path = '/api/v1/search/videos'

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: search,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
