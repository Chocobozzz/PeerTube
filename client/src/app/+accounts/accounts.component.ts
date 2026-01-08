import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, inject, viewChild } from '@angular/core'
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import {
  AuthService,
  MarkdownService,
  MetaService,
  Notifier,
  PeerTubeRouterService,
  RedirectService,
  RestExtractor,
  ScreenService,
  UserService
} from '@app/core'
import { Account } from '@app/shared/shared-main/account/account.model'
import { AccountService } from '@app/shared/shared-main/account/account.service'
import { DropdownAction } from '@app/shared/shared-main/buttons/action-dropdown.component'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { AccountReportComponent } from '@app/shared/shared-moderation/report-modals'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { HttpStatusCode, User, UserRight } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators'
import { ActorAvatarComponent } from '../shared/shared-actor-image/actor-avatar.component'
import { CopyButtonComponent } from '../shared/shared-main/buttons/copy-button.component'
import { SimpleSearchInputComponent } from '../shared/shared-main/search/simple-search-input.component'
import { AccountBlockBadgesComponent } from '../shared/shared-moderation/account-block-badges.component'
import { UserModerationDropdownComponent } from '../shared/shared-moderation/user-moderation-dropdown.component'
import { SubscribeButtonComponent } from '../shared/shared-user-subscription/subscribe-button.component'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ],
  imports: [
    CommonModule,
    ActorAvatarComponent,
    UserModerationDropdownComponent,
    NgbTooltip,
    AccountBlockBadgesComponent,
    CopyButtonComponent,
    RouterLink,
    SubscribeButtonComponent,
    RouterLinkActive,
    HorizontalMenuComponent,
    SimpleSearchInputComponent,
    RouterOutlet,
    AccountReportComponent,
    HorizontalMenuComponent
  ]
})
export class AccountsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute)
  private userService = inject(UserService)
  private accountService = inject(AccountService)
  private videoChannelService = inject(VideoChannelService)
  private notifier = inject(Notifier)
  private restExtractor = inject(RestExtractor)
  private redirectService = inject(RedirectService)
  private authService = inject(AuthService)
  private videoService = inject(VideoService)
  private markdown = inject(MarkdownService)
  private blocklist = inject(BlocklistService)
  private screenService = inject(ScreenService)
  private metaService = inject(MetaService)
  private peertubeRouter = inject(PeerTubeRouterService)

  readonly accountReportModal = viewChild<AccountReportComponent>('accountReportModal')

  account: Account
  accountUser: User

  search = ''

  videoChannels: VideoChannel[] = []

  links: HorizontalMenuEntry[] = []
  hideMenu = false

  accountVideosCount: number
  accountDescriptionHTML = ''
  accountDescriptionExpanded = false

  prependModerationActions: DropdownAction<any>[] = []

  private routeSub: Subscription

  ngOnInit () {
    this.routeSub = this.route.params
      .pipe(
        map(params => params['accountId']),
        distinctUntilChanged(),
        switchMap(accountId => this.accountService.getAccount(accountId)),
        tap(account => this.onAccount(account)),
        switchMap(account => this.videoChannelService.listAccountChannels({ account })),
        catchError(err =>
          this.restExtractor.redirectTo404IfNotFound(err, 'other', [
            HttpStatusCode.BAD_REQUEST_400,
            HttpStatusCode.NOT_FOUND_404
          ])
        )
      )
      .subscribe({
        next: videoChannels => {
          this.videoChannels = videoChannels.data
        },

        error: err => this.notifier.handleError(err)
      })

    this.links = [
      { label: $localize`Channels`, routerLink: 'video-channels' },
      { label: $localize`Videos`, routerLink: 'videos' }
    ]

    this.search = this.route.snapshot.queryParams['search'] || ''
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  naiveAggregatedSubscribers () {
    return this.videoChannels.reduce(
      (acc, val) => acc + val.followersCount,
      this.account.followersCount // accumulator starts with the base number of subscribers the account has
    )
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  isInSmallView () {
    return this.screenService.isInSmallView()
  }

  getAccountAvatarSize () {
    if (this.isInSmallView()) return 80

    return 120
  }

  isManageable () {
    if (!this.isUserLoggedIn()) return false

    return this.account?.userId === this.authService.getUser().id
  }

  onUserChanged () {
    this.loadUserIfNeeded(this.account)
  }

  onUserDeleted () {
    this.redirectService.redirectToHomepage()
  }

  searchChanged (search: string) {
    const queryParams = { search }

    this.peertubeRouter.silentNavigate([ './videos' ], queryParams, this.route)
  }

  onSearchInputDisplayChanged (displayed: boolean) {
    this.hideMenu = this.isInSmallView() && displayed
  }

  hasVideoChannels () {
    return this.videoChannels.length !== 0
  }

  hasShowMoreDescription () {
    return !this.accountDescriptionExpanded && this.accountDescriptionHTML.length > 100
  }

  isOnChannelPage () {
    return this.route.children[0].snapshot.url[0].path === 'video-channels'
  }

  private async onAccount (account: Account) {
    this.metaService.setTitle(account.displayName)

    this.accountDescriptionHTML = await this.markdown.textMarkdownToHTML({
      markdown: account.description,
      withEmoji: true,
      withHtml: true
    })

    // After the markdown renderer to avoid layout changes
    this.account = account

    this.updateModerationActions()
    this.loadUserIfNeeded(account)
    this.loadAccountVideosCount()
    this.loadAccountBlockStatus()
  }

  private showReportModal () {
    this.accountReportModal().show(this.account)
  }

  private loadUserIfNeeded (account: Account) {
    if (!account.userId || !this.authService.isLoggedIn()) return

    const user = this.authService.getUser()
    if (user.hasRight(UserRight.MANAGE_USERS)) {
      this.userService.getUser(account.userId)
        .subscribe({
          next: accountUser => {
            this.accountUser = accountUser
          },

          error: err => this.notifier.handleError(err)
        })
    }
  }

  private updateModerationActions () {
    this.prependModerationActions = []

    if (!this.authService.isLoggedIn()) return
    if (this.isManageable()) return

    // It's not our account, we can report it
    this.prependModerationActions = [
      {
        label: $localize`Report`,
        isHeader: true
      },
      {
        label: $localize`Report this account`,
        handler: () => this.showReportModal()
      }
    ]
  }

  private loadAccountVideosCount () {
    this.videoService.listAccountVideos({
      account: this.account,
      videoPagination: {
        currentPage: 1,
        itemsPerPage: 0
      },
      sort: '-publishedAt'
    }).subscribe(res => {
      this.accountVideosCount = res.total
    })
  }

  private loadAccountBlockStatus () {
    this.blocklist.getStatus({ accounts: [ this.account.nameWithHostForced ], hosts: [ this.account.host ] })
      .subscribe(status => this.account.updateBlockStatus(status))
  }
}
