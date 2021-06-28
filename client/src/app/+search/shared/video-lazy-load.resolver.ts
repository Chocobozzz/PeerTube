import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { Video } from '@app/shared/shared-main'
import { SearchService } from '@app/shared/shared-search'
import { AbstractLazyLoadResolver } from './abstract-lazy-load.resolver'

@Injectable()
export class VideoLazyLoadResolver extends AbstractLazyLoadResolver<Video> {

  constructor (
    protected router: Router,
    private searchService: SearchService
  ) {
    super()
  }

  protected finder (url: string) {
    return this.searchService.searchVideos({ search: url })
  }

  protected buildUrl (video: Video) {
    return Video.buildWatchUrl(video)
  }
}
