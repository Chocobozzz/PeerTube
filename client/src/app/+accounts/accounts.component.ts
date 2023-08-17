import { Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, MarkdownService, Notifier, RedirectService, RestExtractor, ScreenService, UserService } from '@app/core'
import {
  Account,
  AccountService,
  DropdownAction,
  ListOverflowItem,
  VideoChannel,
  VideoChannelService,
  VideoService
} from '@app/shared/shared-main'
import { AccountReportComponent, BlocklistService } from '@app/shared/shared-moderation'
import { HttpStatusCode, User, UserRight } from '@peertube/peertube-models'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ]
})
export class AccountsComponent implements OnInit, OnDestroy {
  @ViewChild('accountReportModal') accountReportModal: AccountReportComponent

  account: Account
  accountUser: User

  videoChannels: VideoChannel[] = []

  links: ListOverflowItem[] = []
  hideMenu = false

  accountVideosCount: number
  accountDescriptionHTML = ''
  accountDescriptionExpanded = false

  prependModerationActions: DropdownAction<any>[] = []

  private routeSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private accountService: AccountService,
    private videoChannelService: VideoChannelService,
    private notifier: Notifier,
    private restExtractor: RestExtractor,
    private redirectService: RedirectService,
    private authService: AuthService,
    private videoService: VideoService,
    private markdown: MarkdownService,
    private blocklist: BlocklistService,
    private screenService: ScreenService
  ) {
  }

  ngOnInit () {
    this.routeSub = this.route.params
                        .pipe(
                          map(params => params['accountId']),
                          distinctUntilChanged(),
                          switchMap(accountId => this.accountService.getAccount(accountId)),
                          tap(account => this.onAccount(account)),
                          switchMap(account => this.videoChannelService.listAccountVideoChannels({ account })),
                          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, 'other', [
                            HttpStatusCode.BAD_REQUEST_400,
                            HttpStatusCode.NOT_FOUND_404
                          ]))
                        )
                        .subscribe({
                          next: videoChannels => {
                            this.videoChannels = videoChannels.data
                          },

                          error: err => this.notifier.error(err.message)
                        })

    this.links = [
      { label: $localize`CHANNELS`, routerLink: 'video-channels' },
      { label: $localize`VIDEOS`, routerLink: 'videos' }
    ]
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

    this.router.navigate([ './videos' ], { queryParams, relativeTo: this.route, queryParamsHandling: 'merge' })
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
    this.accountReportModal.show(this.account)
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

          error: err => this.notifier.error(err.message)
        })
    }
  }

  private updateModerationActions () {
    this.prependModerationActions = []

    if (!this.authService.isLoggedIn()) return

    this.authService.userInformationLoaded.subscribe(
      () => {
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
    )
  }

  private loadAccountVideosCount () {
    this.videoService.getAccountVideos({
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
