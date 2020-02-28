import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { immutableAssign } from '@app/shared/misc/utils'
import { AuthService } from '../../core/auth'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoSortField } from '../../shared/video/sort-field.type'
import { VideoService } from '../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ScreenService } from '@app/shared/misc/screen.service'
import { Notifier, ServerService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { UserService } from '@app/shared'
import { LocalStorageService } from '@app/shared/misc/storage.service'

@Component({
  selector: 'my-videos-trending',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoTrendingComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  defaultSort: VideoSortField = '-trending'

  useUserVideoLanguagePreferences = true

  constructor (
    protected i18n: I18n,
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected userService: UserService,
    protected screenService: ScreenService,
    protected storageService: LocalStorageService,
    private videoService: VideoService,
    private hooks: HooksService
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()

    this.generateSyndicationList()

    this.serverService.getConfig().subscribe(
      config => {
        const trendingDays = config.trending.videos.intervalDays

        if (trendingDays === 1) {
          this.titlePage = this.i18n('Trending for the last 24 hours')
          this.titleTooltip = this.i18n('Trending videos are those totalizing the greatest number of views during the last 24 hours')
        } else {
          this.titlePage = this.i18n('Trending for the last {{days}} days', { days: trendingDays })
          this.titleTooltip = this.i18n(
            'Trending videos are those totalizing the greatest number of views during the last {{days}} days',
            { days: trendingDays }
          )
        }
      })
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })
    const params = {
      videoPagination: newPagination,
      sort: this.sort,
      categoryOneOf: this.categoryOneOf,
      languageOneOf: this.languageOneOf,
      skipCount: true
    }

    return this.hooks.wrapObsFun(
      this.videoService.getVideos.bind(this.videoService),
      params,
      'common',
      'filter:api.trending-videos.videos.list.params',
      'filter:api.trending-videos.videos.list.result'
    )
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoFeedUrls(this.sort, undefined, this.categoryOneOf)
  }
}
