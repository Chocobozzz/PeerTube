import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { immutableAssign } from '@app/shared/misc/utils'
import { AuthService } from '../../core/auth'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoSortField } from '../../shared/video/sort-field.type'
import { VideoService } from '../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ScreenService } from '@app/shared/misc/screen.service'
import { Notifier, ServerService } from '@app/core'

@Component({
  selector: 'my-videos-trending',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoTrendingComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  currentRoute = '/videos/trending'
  defaultSort: VideoSortField = '-trending'
  trendingDays: number

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected location: Location,
    protected screenService: ScreenService,
    private serverService: ServerService,
    protected i18n: I18n,
    private videoService: VideoService
  ) {
    super()

    this.trendingDays = this.serverService.getConfig().trending.videos.intervalDays

    this.titlePage = this.i18n('Trending for the last ')
    this.trendingDays === 1 ? this.titlePage += '24 hours' : this.titlePage += this.trendingDays + ' days'

    this.titleTooltip = this.i18n('trending videos are those totalizing the greatest number of views during the last ')
    this.trendingDays === 1 ? this.titleTooltip += '24 hours.' : this.titleTooltip += this.trendingDays + ' days.'
  }

  ngOnInit () {
    super.ngOnInit()

    this.generateSyndicationList()
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })
    return this.videoService.getVideos(newPagination, this.sort, undefined, this.categoryOneOf)
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoFeedUrls(this.sort, undefined, this.categoryOneOf)
  }
}
