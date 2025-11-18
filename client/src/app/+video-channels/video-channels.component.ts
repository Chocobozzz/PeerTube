import { NgClass, NgTemplateOutlet } from '@angular/common'
import { Component, OnDestroy, OnInit, inject, viewChild } from '@angular/core'
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router'
import { AuthService, Hotkey, HotkeysService, MarkdownService, MetaService, RestExtractor, ScreenService, ServerService } from '@app/core'
import { getOriginUrl } from '@app/helpers'
import { Account } from '@app/shared/shared-main/account/account.model'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { SupportModalComponent } from '@app/shared/shared-support-modal/support-modal.component'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription/subscribe-button.component'
import { getChannelRSSFeeds } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators'
import { ActorAvatarComponent } from '../shared/shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { CopyButtonComponent } from '../shared/shared-main/buttons/copy-button.component'
import { AccountBlockBadgesComponent } from '../shared/shared-moderation/account-block-badges.component'

@Component({
  templateUrl: './video-channels.component.html',
  styleUrls: [ './video-channels.component.scss' ],
  imports: [
    RouterLink,
    SubscribeButtonComponent,
    GlobalIconComponent,
    ActorAvatarComponent,
    AccountBlockBadgesComponent,
    CopyButtonComponent,
    NgTemplateOutlet,
    NgClass,
    HorizontalMenuComponent,
    RouterOutlet,
    SupportModalComponent
  ]
})
export class VideoChannelsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute)
  private authService = inject(AuthService)
  private videoChannelService = inject(VideoChannelService)
  private videoService = inject(VideoService)
  private restExtractor = inject(RestExtractor)
  private hotkeysService = inject(HotkeysService)
  private screenService = inject(ScreenService)
  private markdown = inject(MarkdownService)
  private blocklist = inject(BlocklistService)
  private metaService = inject(MetaService)
  private server = inject(ServerService)

  readonly subscribeButton = viewChild<SubscribeButtonComponent>('subscribeButton')
  readonly supportModal = viewChild<SupportModalComponent>('supportModal')

  videoChannel: VideoChannel
  ownerAccount: Account
  hotkeys: Hotkey[]
  links: HorizontalMenuEntry[] = []
  isChannelManageable = false

  channelVideosCount: number
  ownerDescriptionHTML = ''
  channelDescriptionHTML = ''
  channelDescriptionExpanded = false

  private routeSub: Subscription

  ngOnInit () {
    this.routeSub = this.route.params
      .pipe(
        map(params => params['videoChannelName']),
        distinctUntilChanged(),
        switchMap(videoChannelName => this.videoChannelService.get(videoChannelName)),
        catchError(err =>
          this.restExtractor.redirectTo404IfNotFound(err, 'other', [
            HttpStatusCode.BAD_REQUEST_400,
            HttpStatusCode.NOT_FOUND_404
          ])
        )
      )
      .subscribe(async videoChannel => {
        const instanceName = this.server.getHTMLConfig().instance.name

        this.metaService.setTitle(videoChannel.displayName)
        this.metaService.setRSSFeeds(
          getChannelRSSFeeds({
            url: getOriginUrl(),
            channel: videoChannel,
            titles: {
              instanceVideosFeed: `${instanceName} - Videos feed`,
              channelVideosFeed: `${videoChannel.displayName} - Videos feed`,
              channelPodcastFeed: `${videoChannel.displayName} - Podcast feed`
            }
          })
        )

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
        const subscribeButton = this.subscribeButton()
        if (subscribeButton.isSubscribedToAll()) subscribeButton.unsubscribe()
        else subscribeButton.subscribe()

        return false
      }, $localize`Subscribe to the account`)
    ]
    if (this.isUserLoggedIn()) this.hotkeysService.add(this.hotkeys)

    this.links = [
      { label: $localize`Videos`, routerLink: 'videos' },
      { label: $localize`Playlists`, routerLink: 'video-playlists' }
    ]
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()

    // Unbind hotkeys
    if (this.isUserLoggedIn()) this.hotkeysService.remove(this.hotkeys)

    this.metaService.revertMetaTags()
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
    this.supportModal().show()
  }

  getAccountUrl () {
    return [ '/a', this.videoChannel.ownerBy ]
  }

  private loadChannelVideosCount () {
    this.videoService.listChannelVideos({
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
