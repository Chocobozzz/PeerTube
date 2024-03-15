import { Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { AuthService, MarkdownService, Notifier, RestExtractor, ScreenService, Hotkey, HotkeysService } from '@app/core'
import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { ListOverflowComponent, ListOverflowItem } from '../shared/shared-main/misc/list-overflow.component'
import { CopyButtonComponent } from '../shared/shared-main/buttons/copy-button.component'
import { AccountBlockBadgesComponent } from '../shared/shared-moderation/account-block-badges.component'
import { ActorAvatarComponent } from '../shared/shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { NgIf, NgTemplateOutlet, NgClass, DatePipe } from '@angular/common'
import { VideoChannelService } from '@app/shared/shared-main/video-channel/video-channel.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoChannel } from '@app/shared/shared-main/video-channel/video-channel.model'
import { Account } from '@app/shared/shared-main/account/account.model'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { SupportModalComponent } from '@app/shared/shared-support-modal/support-modal.component'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription/subscribe-button.component'

@Component({
  templateUrl: './video-channels.component.html',
  styleUrls: [ './video-channels.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    RouterLink,
    SubscribeButtonComponent,
    GlobalIconComponent,
    ActorAvatarComponent,
    AccountBlockBadgesComponent,
    CopyButtonComponent,
    NgTemplateOutlet,
    NgClass,
    RouterLinkActive,
    ListOverflowComponent,
    RouterOutlet,
    SupportModalComponent,
    DatePipe
  ]
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
                          this.channelDescriptionHTML = await this.markdown.textMarkdownToHTML({
                            markdown: videoChannel.description,
                            withEmoji: true,
                            withHtml: true
                          })

                          this.ownerDescriptionHTML = await this.markdown.textMarkdownToHTML({
                            markdown: videoChannel.ownerAccount.description,
                            withEmoji: true,
                            withHtml: true
                          })

                          // After the markdown renderer to avoid layout changes
                          this.videoChannel = videoChannel
                          this.ownerAccount = new Account(this.videoChannel.ownerAccount)

                          this.loadChannelVideosCount()
                          this.loadOwnerBlockStatus()
                        })

    this.hotkeys = [
      new Hotkey('Shift+s', () => {
        if (this.subscribeButton.isSubscribedToAll()) this.subscribeButton.unsubscribe()
        else this.subscribeButton.subscribe()

        return false
      }, $localize`Subscribe to the account`)
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

  getAccountAvatarSize () {
    if (this.isInSmallView()) return 64

    return 48
  }

  getChannelAvatarSize () {
    if (this.isInSmallView()) return 80

    return 120
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  isOwner () {
    if (!this.isUserLoggedIn()) return false

    return this.videoChannel?.ownerAccount.userId === this.authService.getUser().id
  }

  isManageable () {
    if (!this.videoChannel.isLocal) return false
    if (!this.isUserLoggedIn()) return false

    return this.isOwner() || this.authService.getUser().hasRight(UserRight.MANAGE_ANY_VIDEO_CHANNEL)
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
