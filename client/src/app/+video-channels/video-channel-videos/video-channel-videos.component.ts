import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { immutableAssign } from '@app/shared/misc/utils'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoService } from '../../shared/video/video.service'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { first, tap } from 'rxjs/operators'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'
import { ScreenService } from '@app/shared/misc/screen.service'
import { Notifier, ServerService } from '@app/core'
import { UserService } from '@app/shared'
import { LocalStorageService } from '@app/shared/misc/storage.service'

@Component({
  selector: 'my-video-channel-videos',
  templateUrl: '../../shared/video/abstract-video-list.html',
  styleUrls: [
    '../../shared/video/abstract-video-list.scss',
    './video-channel-videos.component.scss'
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
               .getVideoChannelVideos(this.videoChannel, newPagination, this.sort)
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
