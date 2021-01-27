import { Component, ComponentFactoryResolver, Injector, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, LocalStorageService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { immutableAssign } from '@app/helpers'
import { VideoService } from '@app/shared/shared-main'
import { AbstractVideoList } from '@app/shared/shared-video-miniature'
import { VideoSortField } from '@shared/models'
import { VideoTrendingHeaderComponent } from './video-trending-header.component'

@Component({
  selector: 'my-videos-most-liked',
  styleUrls: [ '../../../shared/shared-video-miniature/abstract-video-list.scss' ],
  templateUrl: '../../../shared/shared-video-miniature/abstract-video-list.html'
})
export class VideoMostLikedComponent extends AbstractVideoList implements OnInit {
  HeaderComponent = VideoTrendingHeaderComponent
  titlePage: string
  defaultSort: VideoSortField = '-likes'

  useUserVideoPreferences = true

  constructor (
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected userService: UserService,
    protected screenService: ScreenService,
    protected storageService: LocalStorageService,
    protected cfr: ComponentFactoryResolver,
    private videoService: VideoService,
    private hooks: HooksService
  ) {
    super()

    this.headerComponentInjector = this.getInjector()
  }

  ngOnInit () {
    super.ngOnInit()

    this.generateSyndicationList()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })
    const params = {
      videoPagination: newPagination,
      sort: this.sort,
      categoryOneOf: this.categoryOneOf,
      languageOneOf: this.languageOneOf,
      nsfwPolicy: this.nsfwPolicy,
      skipCount: true
    }

    return this.hooks.wrapObsFun(
      this.videoService.getVideos.bind(this.videoService),
      params,
      'common',
      'filter:api.most-liked-videos.videos.list.params',
      'filter:api.most-liked-videos.videos.list.result'
    )
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoFeedUrls(this.sort, undefined, this.categoryOneOf)
  }

  getInjector () {
    return Injector.create({
      providers: [{
        provide: 'data',
        useValue: {
          model: this.defaultSort
        }
      }]
    })
  }
}
