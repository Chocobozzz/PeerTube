import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, Notifier, RestExtractor, ScreenService } from '@app/core'
import { ListOverflowItem, VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'

@Component({
  templateUrl: './video-channels.component.html',
  styleUrls: [ './video-channels.component.scss' ]
})
export class VideoChannelsComponent implements OnInit, OnDestroy {
  @ViewChild('subscribeButton') subscribeButton: SubscribeButtonComponent

  videoChannel: VideoChannel
  hotkeys: Hotkey[]
  links: ListOverflowItem[] = []
  isChannelManageable = false

  private routeSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private notifier: Notifier,
    private authService: AuthService,
    private videoChannelService: VideoChannelService,
    private restExtractor: RestExtractor,
    private hotkeysService: HotkeysService,
    private screenService: ScreenService
  ) { }

  ngOnInit () {
    this.routeSub = this.route.params
                        .pipe(
                          map(params => params[ 'videoChannelName' ]),
                          distinctUntilChanged(),
                          switchMap(videoChannelName => this.videoChannelService.getVideoChannel(videoChannelName)),
                          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [
                            HttpStatusCode.BAD_REQUEST_400,
                            HttpStatusCode.NOT_FOUND_404
                          ]))
                        )
                        .subscribe(videoChannel => {
                          this.videoChannel = videoChannel

                          if (this.authService.isLoggedIn()) {
                            this.authService.userInformationLoaded
                              .subscribe(() => {
                                const channelUserId = this.videoChannel.ownerAccount.userId
                                this.isChannelManageable = channelUserId && channelUserId === this.authService.getUser().id
                              })
                          }
                        })

    this.hotkeys = [
      new Hotkey('S', (event: KeyboardEvent): boolean => {
        this.subscribeButton.subscribed ?
          this.subscribeButton.unsubscribe() :
          this.subscribeButton.subscribe()
        return false
      }, undefined, $localize`Subscribe to the account`)
    ]
    if (this.isUserLoggedIn()) this.hotkeysService.add(this.hotkeys)

    this.links = [
      { label: $localize`VIDEOS`, routerLink: 'videos' },
      { label: $localize`VIDEO PLAYLISTS`, routerLink: 'video-playlists' },
      { label: $localize`ABOUT`, routerLink: 'about' }
    ]
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()

    // Unbind hotkeys
    if (this.isUserLoggedIn()) this.hotkeysService.remove(this.hotkeys)
  }

  get isInSmallView () {
    return this.screenService.isInSmallView()
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  get isManageable () {
    if (!this.isUserLoggedIn()) return false
    return this.videoChannel.ownerAccount.userId === this.authService.getUser().id
  }

  activateCopiedMessage () {
    this.notifier.success($localize`Username copied`)
  }
}
