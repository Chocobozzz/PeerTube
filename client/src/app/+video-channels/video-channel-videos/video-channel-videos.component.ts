import { Subscription } from 'rxjs'
import { first, tap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, LocalStorageService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import { immutableAssign } from '@app/helpers'
import { VideoChannel, VideoChannelService, VideoService } from '@app/shared/shared-main'
import { AbstractVideoList } from '@app/shared/shared-video-miniature'

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

    this.titlePage = $localize`Published videos`
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
                   this.titlePage = total === 1
                    ? $localize`Published 1 video`
                    : $localize`Published ${total} videos`
                 })
               )
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoChannelFeedUrls(this.videoChannel.id)
  }
}
