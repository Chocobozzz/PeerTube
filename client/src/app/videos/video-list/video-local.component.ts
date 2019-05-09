import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { immutableAssign } from '@app/shared/misc/utils'
import { AuthService } from '../../core/auth'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoSortField } from '../../shared/video/sort-field.type'
import { VideoService } from '../../shared/video/video.service'
import { VideoFilter } from '../../../../../shared/models/videos/video-query.type'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ScreenService } from '@app/shared/misc/screen.service'
import { UserRight } from '../../../../../shared/models/users'
import { Notifier, ServerService } from '@app/core'

@Component({
  selector: 'my-videos-local',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoLocalComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  sort = '-publishedAt' as VideoSortField
  filter: VideoFilter = 'local'

  constructor (
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected screenService: ScreenService,
    private i18n: I18n,
    private videoService: VideoService
  ) {
    super()

    this.titlePage = i18n('Local videos')
  }

  ngOnInit () {
    super.ngOnInit()

    if (this.authService.isLoggedIn()) {
      const user = this.authService.getUser()
      this.displayModerationBlock = user.hasRight(UserRight.SEE_ALL_VIDEOS)
    }

    this.generateSyndicationList()
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.videoService.getVideos(newPagination, this.sort, this.filter, this.categoryOneOf)
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoFeedUrls(this.sort, this.filter, this.categoryOneOf)
  }

  toggleModerationDisplay () {
    this.filter = this.filter === 'local' ? 'all-local' as 'all-local' : 'local' as 'local'

    this.reloadVideos()
  }
}
