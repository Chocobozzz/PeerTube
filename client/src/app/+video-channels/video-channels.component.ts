import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, MarkdownService, Notifier, RestExtractor, ScreenService } from '@app/core'
import { Account, ListOverflowItem, VideoChannel, VideoChannelService, VideoService } from '@app/shared/shared-main'
import { BlocklistService } from '@app/shared/shared-moderation'
import { SupportModalComponent } from '@app/shared/shared-support-modal'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription'
import { HttpStatusCode, UserRight } from '@shared/models'

@Component({
  templateUrl: './video-channels.component.html',
  styleUrls: [ './video-channels.component.scss' ]
})
export class VideoChannelsComponent implements OnInit, OnDestroy {
  @ViewChild('subscribeButton') subscribeButton: SubscribeButtonComponent
  @ViewChild('supportModal') supportModal: SupportModalComponent

  videoChannel: VideoChannel
  ownerAccount: Account
  hotkeys: Hotkey[]
  links: ListOverflowItem[] = []
  isChannelManageable = false

  channelVideosCount: number
  ownerDescriptionHTML = ''
  channelDescriptionHTML = ''
  channelDescriptionExpanded = false

  private routeSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private notifier: Notifier,
    private authService: AuthService,
    private videoChannelService: VideoChannelService,
    private videoService: VideoService,
    private restExtractor: RestExtractor,
    private hotkeysService: HotkeysService,
    private screenService: ScreenService,
    private markdown: MarkdownService,
    private blocklist: BlocklistService
  ) { }

  ngOnInit () {
    this.routeSub = this.route.params
                        .pipe(
                          map(params => params['videoChannelName']),
                          distinctUntilChanged(),
                          switchMap(videoChannelName => this.videoChannelService.getVideoChannel(videoChannelName)),
                          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, 'other', [
                            HttpStatusCode.BAD_REQUEST_400,
                            HttpStatusCode.NOT_FOUND_404
                          ]))
                        )
                        .subscribe(async videoChannel => {
                          this.channelDescriptionHTML = await this.markdown.textMarkdownToHTML(videoChannel.description)
                          this.ownerDescriptionHTML = await this.markdown.textMarkdownToHTML(videoChannel.ownerAccount.description)

                          // After the markdown renderer to avoid layout changes
                          this.videoChannel = videoChannel
                          this.ownerAccount = new Account(this.videoChannel.ownerAccount)

                          this.loadChannelVideosCount()
                          this.loadOwnerBlockStatus()
                        })

    this.hotkeys = [
      new Hotkey('S', (event: KeyboardEvent): boolean => {
        if (this.subscribeButton.subscribed) this.subscribeButton.unsubscribe()
        else this.subscribeButton.subscribe()

        return false
      }, undefined, $localize`Subscribe to the account`)
    ]
    if (this.isUserLoggedIn()) this.hotkeysService.add(this.hotkeys)

    this.links = [
      { label: $localize`VIDEOS`, routerLink: 'videos' },
      { label: $localize`PLAYLISTS`, routerLink: 'video-playlists' }
    ]
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()

    // Unbind hotkeys
    if (this.isUserLoggedIn()) this.hotkeysService.remove(this.hotkeys)
  }

  isInSmallView () {
    return this.screenService.isInSmallView()
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  isOwner () {
    if (!this.isUserLoggedIn()) return false

    return this.videoChannel?.ownerAccount.userId === this.authService.getUser().id
  }

  isManageable () {
    if (!this.isUserLoggedIn()) return false

    return this.isOwner() || this.authService.getUser().hasRight(UserRight.MANAGE_ANY_VIDEO_CHANNEL)
  }

  activateCopiedMessage () {
    this.notifier.success($localize`Username copied`)
  }

  hasShowMoreDescription () {
    return !this.channelDescriptionExpanded && this.channelDescriptionHTML.length > 100
  }

  showSupportModal () {
    this.supportModal.show()
  }

  getAccountUrl () {
    return [ '/a', this.videoChannel.ownerBy ]
  }

  private loadChannelVideosCount () {
    this.videoService.getVideoChannelVideos({
      videoChannel: this.videoChannel,
      videoPagination: {
        currentPage: 1,
        itemsPerPage: 0
      },
      sort: '-publishedAt'
    }).subscribe(res => this.channelVideosCount = res.total)
  }

  private loadOwnerBlockStatus () {
    this.blocklist.getStatus({ accounts: [ this.ownerAccount.nameWithHostForced ], hosts: [ this.ownerAccount.host ] })
      .subscribe(status => this.ownerAccount.updateBlockStatus(status))
  }
}
