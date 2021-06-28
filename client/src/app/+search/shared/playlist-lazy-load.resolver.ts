import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { SearchService } from '@app/shared/shared-search'
import { VideoPlaylist } from '@app/shared/shared-video-playlist'
import { AbstractLazyLoadResolver } from './abstract-lazy-load.resolver'

@Injectable()
export class PlaylistLazyLoadResolver extends AbstractLazyLoadResolver<VideoPlaylist> {

  constructor (
    protected router: Router,
    private searchService: SearchService
  ) {
    super()
  }

  protected finder (url: string) {
    return this.searchService.searchVideoPlaylists({ search: url })
  }

  protected buildUrl (playlist: VideoPlaylist) {
    return VideoPlaylist.buildWatchUrl(playlist)
  }
}
