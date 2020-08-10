import { Subscription } from 'rxjs'
import { first, tap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, LocalStorageService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import { immutableAssign } from '@app/helpers'
import { VideoChannel, VideoChannelService, VideoService } from '@app/shared/shared-main'
import { AbstractVideoList } from '@app/shared/shared-video-miniature'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-video-channel-videos',
  templateUrl: '../../shared/shared-video-miniature/abstract-video-list.html',
  styleUrls: [
    '../../shared/shared-video-miniature/abstract-video-list.scss'
  ]
})
export class VideoChannelVideosComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  loadOnInit = false

  private videoChannel: VideoChannel
  private videoChannelSub: Subscription

  constructor (
    protected i18n: I18n,
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    protected userService: UserService,
    protected notifier: Notifier,
    protected confirmService: ConfirmService,
    protected screenService: ScreenService,
    protected storageService: LocalStorageService,
    private videoChannelService: VideoChannelService,
    private videoService: VideoService
  ) {
    super()

    this.titlePage = this.i18n('Published videos')
    this.displayOptions = {
      ...this.displayOptions,
      avatar: false
    }
  }

  ngOnInit () {
    super.ngOnInit()

    // Parent get the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
                               .pipe(first())
                               .subscribe(videoChannel => {
                                 this.videoChannel = videoChannel

                                 this.reloadVideos()
                                 this.generateSyndicationList()
                               })
  }

  ngOnDestroy () {
    if (this.videoChannelSub) this.videoChannelSub.unsubscribe()

    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.videoService
               .getVideoChannelVideos(this.videoChannel, newPagination, this.sort, this.nsfwPolicy)
               .pipe(
                 tap(({ total }) => {
                   this.titlePage = this.i18n(`{total, plural, =1 {Published 1 video} other {Published {{total}} videos}}`, { total })
                 })
               )
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoChannelFeedUrls(this.videoChannel.id)
  }
}
