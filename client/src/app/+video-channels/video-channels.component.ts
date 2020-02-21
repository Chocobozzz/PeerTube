import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { RestExtractor } from '@app/shared'
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators'
import { Subscription } from 'rxjs'
import { AuthService, Notifier } from '@app/core'
import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { SubscribeButtonComponent } from '@app/shared/user-subscription/subscribe-button.component'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ListOverflowItem } from '@app/shared/misc/list-overflow.component'

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
    private i18n: I18n,
    private route: ActivatedRoute,
    private notifier: Notifier,
    private authService: AuthService,
    private videoChannelService: VideoChannelService,
    private restExtractor: RestExtractor,
    private hotkeysService: HotkeysService
  ) { }

  ngOnInit () {
    this.routeSub = this.route.params
                        .pipe(
                          map(params => params[ 'videoChannelName' ]),
                          distinctUntilChanged(),
                          switchMap(videoChannelName => this.videoChannelService.getVideoChannel(videoChannelName)),
                          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 404 ]))
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
      }, undefined, this.i18n('Subscribe to the account'))
    ]
    if (this.isUserLoggedIn()) this.hotkeysService.add(this.hotkeys)

    this.links = [
      { label: this.i18n('VIDEOS'), routerLink: 'videos' },
      { label: this.i18n('VIDEO PLAYLISTS'), routerLink: 'video-playlists' },
      { label: this.i18n('ABOUT'), routerLink: 'about' }
    ]
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()

    // Unbind hotkeys
    if (this.isUserLoggedIn()) this.hotkeysService.remove(this.hotkeys)
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  get isManageable () {
    if (!this.isUserLoggedIn()) return false
    return this.videoChannel.ownerAccount.userId === this.authService.getUser().id
  }

  activateCopiedMessage () {
    this.notifier.success(this.i18n('Username copied'))
  }
}
