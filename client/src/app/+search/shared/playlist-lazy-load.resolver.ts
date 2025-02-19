import { Injectable, inject } from '@angular/core'
import { Router } from '@angular/router'
import { AbstractLazyLoadResolver } from './abstract-lazy-load.resolver'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { SearchService } from '@app/shared/shared-search/search.service'

@Injectable()
export class PlaylistLazyLoadResolver extends AbstractLazyLoadResolver<VideoPlaylist> {
  protected router = inject(Router)
  private searchService = inject(SearchService)

  protected finder (url: string) {
    return this.searchService.searchVideoPlaylists({ search: url })
  }

  protected buildUrl (playlist: VideoPlaylist) {
    return VideoPlaylist.buildWatchUrl(playlist)
  }
}
