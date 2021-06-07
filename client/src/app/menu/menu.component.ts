import { HotkeysService } from 'angular2-hotkeys'
import * as debug from 'debug'
import { switchMap } from 'rxjs/operators'
import { ViewportScroller } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import {
  AuthService,
  AuthStatus,
  AuthUser,
  MenuLink,
  MenuService,
  RedirectService,
  ScreenService,
  ServerService,
  UserService
} from '@app/core'
import { scrollToTop } from '@app/helpers'
import { LanguageChooserComponent } from '@app/menu/language-chooser.component'
import { QuickSettingsModalComponent } from '@app/modal/quick-settings-modal.component'
import { PeertubeModalService } from '@app/shared/shared-main/peertube-modal/peertube-modal.service'
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, ServerConfig, UserRight, VideoConstant } from '@shared/models'
import { GlobalIconName } from '../shared/shared-icons/global-icon.component'
import { HooksService } from '../core/plugins/hooks.service'

const logger = debug('peertube:menu:MenuComponent')

interface MenuItem {
  key: string
  title: string
  links: MenuLink[]
}

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit {
  @ViewChild('languageChooserModal', { static: true }) languageChooserModal: LanguageChooserComponent
  @ViewChild('quickSettingsModal', { static: true }) quickSettingsModal: QuickSettingsModalComponent
  @ViewChild('dropdown') dropdown: NgbDropdown

  user: AuthUser
  isLoggedIn: boolean

  userHasAdminAccess = false
  helpVisible = false

  videoLanguages: string[] = []
  nsfwPolicy: string

  currentInterfaceLanguage: string
  menuItems: MenuItem[]

  private languages: VideoConstant<string>[] = []

  private htmlServerConfig: HTMLServerConfig
  private serverConfig: ServerConfig

  private routesPerRight: { [role in UserRight]?: string } = {
    [UserRight.MANAGE_USERS]: '/admin/users',
    [UserRight.MANAGE_SERVER_FOLLOW]: '/admin/friends',
    [UserRight.MANAGE_ABUSES]: '/admin/moderation/abuses',
    [UserRight.MANAGE_VIDEO_BLACKLIST]: '/admin/moderation/video-blocks',
    [UserRight.MANAGE_JOBS]: '/admin/jobs',
    [UserRight.MANAGE_CONFIGURATION]: '/admin/config'
  }

  constructor (
    private viewportScroller: ViewportScroller,
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private hotkeysService: HotkeysService,
    private screenService: ScreenService,
    private menuService: MenuService,
    private modalService: PeertubeModalService,
    private router: Router,
    private hooks: HooksService
  ) { }

  get isInMobileView () {
    return this.screenService.isInMobileView()
  }

  get dropdownContainer () {
    if (this.isInMobileView) return null

    return 'body' as 'body'
  }

  get language () {
    return this.languageChooserModal.getCurrentLanguage()
  }

  get instanceName () {
    return this.htmlServerConfig.instance.name
  }

  ngOnInit () {
    this.htmlServerConfig = this.serverService.getHTMLConfig()
    this.computeMenuItems()

    this.isLoggedIn = this.authService.isLoggedIn()
    if (this.isLoggedIn === true) {
      this.user = this.authService.getUser()

      this.computeNSFWPolicy()
      this.computeVideosLink()
    }

    this.computeAdminAccess()

    this.currentInterfaceLanguage = this.languageChooserModal.getCurrentLanguage()

    this.authService.loginChangedSource.subscribe(
      status => {
        if (status === AuthStatus.LoggedIn) {
          this.isLoggedIn = true
          this.user = this.authService.getUser()
          this.computeMenuItems()

          this.computeAdminAccess()
          this.computeVideosLink()

          logger('Logged in.')
        } else if (status === AuthStatus.LoggedOut) {
          this.isLoggedIn = false
          this.user = undefined

          this.computeAdminAccess()

          logger('Logged out.')
        } else {
          console.error('Unknown auth status: ' + status)
        }
      }
    )

    this.hotkeysService.cheatSheetToggle
      .subscribe(isOpen => this.helpVisible = isOpen)

    this.serverService.getVideoLanguages()
      .subscribe(languages => {
        this.languages = languages

        this.authService.userInformationLoaded
          .subscribe(() => this.buildUserLanguages())
      })

    this.modalService.openQuickSettingsSubject
      .subscribe(() => this.openQuickSettings())
  }

  isRegistrationAllowed () {
    if (!this.serverConfig) return false

    return this.serverConfig.signup.allowed &&
      this.serverConfig.signup.allowedForCurrentIP
  }

  getFirstAdminRightAvailable () {
    const user = this.authService.getUser()
    if (!user) return undefined

    const adminRights = [
      UserRight.MANAGE_USERS,
      UserRight.MANAGE_SERVER_FOLLOW,
      UserRight.MANAGE_ABUSES,
      UserRight.MANAGE_VIDEO_BLACKLIST,
      UserRight.MANAGE_JOBS,
      UserRight.MANAGE_CONFIGURATION
    ]

    for (const adminRight of adminRights) {
      if (user.hasRight(adminRight)) {
        return adminRight
      }
    }

    return undefined
  }

  getFirstAdminRouteAvailable () {
    const right = this.getFirstAdminRightAvailable()

    return this.routesPerRight[right]
  }

  logout (event: Event) {
    event.preventDefault()

    this.authService.logout()
    // Redirect to home page
    this.redirectService.redirectToHomepage()
  }

  openLanguageChooser () {
    this.languageChooserModal.show()
  }

  openHotkeysCheatSheet () {
    this.hotkeysService.cheatSheetToggle.next(!this.helpVisible)
  }

  openQuickSettings () {
    this.quickSettingsModal.show()
  }

  toggleUseP2P () {
    if (!this.user) return
    this.user.webTorrentEnabled = !this.user.webTorrentEnabled

    this.userService.updateMyProfile({ webTorrentEnabled: this.user.webTorrentEnabled })
      .subscribe(() => this.authService.refreshUserInformation())
  }

  langForLocale (localeId: string) {
    if (localeId === '_unknown') return $localize`Unknown`

    return this.languages.find(lang => lang.id === localeId).label
  }

  onActiveLinkScrollToAnchor (link: HTMLAnchorElement) {
    const linkURL = link.getAttribute('href')
    const linkHash = link.getAttribute('fragment')

    // On same url without fragment restore top scroll position
    if (!linkHash && this.router.url.includes(linkURL)) {
      scrollToTop('smooth')
    }

    // On same url with fragment restore anchor scroll position
    if (linkHash && this.router.url === linkURL) {
      this.viewportScroller.scrollToAnchor(linkHash)
    }

    if (this.screenService.isInSmallView()) {
      this.menuService.toggleMenu()
    }
  }

  // Lock menu scroll when menu scroll to avoid fleeing / detached dropdown
  onMenuScrollEvent () {
    document.querySelector('menu').scrollTo(0, 0)
  }

  onDropdownOpenChange (opened: boolean) {
    if (this.screenService.isInMobileView()) return

    // Close dropdown when window scroll to avoid dropdown quick jump for re-position
    const onWindowScroll = () => {
      this.dropdown?.close()
      window.removeEventListener('scroll', onWindowScroll)
    }

    if (opened) {
      window.addEventListener('scroll', onWindowScroll)
      document.querySelector('menu').scrollTo(0, 0) // Reset menu scroll to easy lock
      document.querySelector('menu').addEventListener('scroll', this.onMenuScrollEvent)
    } else {
      document.querySelector('menu').removeEventListener('scroll', this.onMenuScrollEvent)
    }
  }

  private setMenuItems = (items: MenuItem[]) => {
    this.menuItems = items

    return this.menuItems
  }

  private computeMenuItems () {
    const menuItems = [
      {
        key: 'in-my-library',
        title: 'In my library',
        links: [
          {
            path: '/my-library/videos',
            isHidden: !this.user?.canSeeVideosLink,
            icon: 'videos' as GlobalIconName,
            menuLabel: 'Videos'
          },
          {
            path: '/my-library/video-playlists',
            icon: 'playlists' as GlobalIconName,
            menuLabel: 'Playlists'
          },
          {
            path: '/videos/subscriptions',
            icon: 'subscriptions' as GlobalIconName,
            menuLabel: 'Subscriptions'
          },
          {
            path: '/my-library/history/videos',
            icon: 'history' as GlobalIconName,
            menuLabel: 'History'
          }
        ]
      },
      {
        key: 'on-instance',
        title: `On ${this.instanceName}`,
        links: this.menuService.buildCommonLinks(this.htmlServerConfig)
      }
    ]
    .map((block: MenuItem) => ({
      ...block,
      links: block.links.filter(({ isHidden }) => isHidden !== false)
    }))

    this.hooks.wrapFun(this.setMenuItems, menuItems, 'top-menu', 'filter:top-menu.params', 'filter:top-menu.result')
  }

  private buildUserLanguages () {
    if (!this.user) {
      this.videoLanguages = []
      return
    }

    if (!this.user.videoLanguages) {
      this.videoLanguages = [$localize`any language`]
      return
    }

    this.videoLanguages = this.user.videoLanguages
      .map(locale => this.langForLocale(locale))
      .map(value => value === undefined ? '?' : value)
  }

  private computeAdminAccess () {
    const right = this.getFirstAdminRightAvailable()

    this.userHasAdminAccess = right !== undefined
  }

  private computeVideosLink () {
    this.authService.userInformationLoaded
      .pipe(
        switchMap(() => this.user.computeCanSeeVideosLink(this.userService.getMyVideoQuotaUsed()))
      ).subscribe(res => {
        if (res === true) logger('User can see videos link.')
        else logger('User cannot see videos link.')
      })
  }

  private computeNSFWPolicy () {
    if (!this.user) {
      this.nsfwPolicy = null
      return
    }

    switch (this.user.nsfwPolicy) {
      case 'do_not_list':
        this.nsfwPolicy = $localize`hide`
        break

      case 'blur':
        this.nsfwPolicy = $localize`blur`
        break

      case 'display':
        this.nsfwPolicy = $localize`display`
        break
    }
  }
}
