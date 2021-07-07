import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { VideoChannel } from '@app/shared/shared-main'
import { SearchService } from '@app/shared/shared-search'
import { AbstractLazyLoadResolver } from './abstract-lazy-load.resolver'

@Injectable()
export class ChannelLazyLoadResolver extends AbstractLazyLoadResolver<VideoChannel> {

  constructor (
    protected router: Router,
    private searchService: SearchService
  ) {
    super()
  }

  protected finder (url: string) {
    return this.searchService.searchVideoChannels({ search: url })
  }

  protected buildUrl (channel: VideoChannel) {
    return '/video-channels/' + channel.nameWithHost
  }
}
