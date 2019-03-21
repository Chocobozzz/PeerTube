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

@Component({
  selector: 'my-videos-recently-added',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoRecentlyAddedComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  sort: VideoSortField = '-publishedAt'

  constructor (
    protected route: ActivatedRoute,
    protected serverService: ServerService,
    protected router: Router,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected screenService: ScreenService,
    private i18n: I18n,
    private videoService: VideoService
  ) {
    super()

    this.titlePage = i18n('Recently added')
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
