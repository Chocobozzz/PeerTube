import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { AbstractLazyLoadResolver } from './abstract-lazy-load.resolver'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { SearchService } from '@app/shared/shared-search/search.service'

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
