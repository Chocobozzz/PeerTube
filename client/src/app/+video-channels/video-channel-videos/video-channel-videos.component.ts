import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { immutableAssign } from '@app/shared/misc/utils'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoService } from '../../shared/video/video.service'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { tap } from 'rxjs/operators'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'
import { ScreenService } from '@app/shared/misc/screen.service'

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
  marginContent = false // Disable margin
  currentRoute = '/video-channels/videos'
  loadOnInit = false

  private videoChannel: VideoChannel
  private videoChannelSub: Subscription

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    protected notificationsService: NotificationsService,
    protected confirmService: ConfirmService,
    protected location: Location,
    protected screenService: ScreenService,
    protected i18n: I18n,
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
      .subscribe(videoChannel => {
        this.videoChannel = videoChannel
        this.currentRoute = '/video-channels/' + this.videoChannel.uuid + '/videos'

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
                 tap(({ totalVideos }) => {
                   this.titlePage = this.i18n('Published {{totalVideos}} videos', { totalVideos })
                 })
               )
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoChannelFeedUrls(this.videoChannel.id)
  }
}
