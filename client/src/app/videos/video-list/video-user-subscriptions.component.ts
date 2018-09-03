import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { immutableAssign } from '@app/shared/misc/utils'
import { Location } from '@angular/common'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core/auth'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoSortField } from '../../shared/video/sort-field.type'
import { VideoService } from '../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ScreenService } from '@app/shared/misc/screen.service'
import { OwnerDisplayType } from '@app/shared/video/video-miniature.component'

@Component({
  selector: 'my-videos-user-subscriptions',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoUserSubscriptionsComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  currentRoute = '/videos/subscriptions'
  sort = '-publishedAt' as VideoSortField
  ownerDisplayType: OwnerDisplayType = 'auto'

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    protected notificationsService: NotificationsService,
    protected authService: AuthService,
    protected location: Location,
    protected i18n: I18n,
    protected screenService: ScreenService,
    private videoService: VideoService
  ) {
    super()

    this.titlePage = i18n('Videos from your subscriptions')
  }

  ngOnInit () {
    super.ngOnInit()
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.videoService.getUserSubscriptionVideos(newPagination, this.sort)
  }

  generateSyndicationList () {
    // not implemented yet
  }
}
