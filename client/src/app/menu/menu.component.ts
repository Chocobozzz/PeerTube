import { HotkeysService } from 'angular2-hotkeys'
import * as debug from 'debug'
import { switchMap } from 'rxjs/operators'
import { Component, OnInit, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, AuthStatus, AuthUser, MenuService, RedirectService, ScreenService, ServerService, UserService } from '@app/core'
import { LanguageChooserComponent } from '@app/menu/language-chooser.component'
import { QuickSettingsModalComponent } from '@app/modal/quick-settings-modal.component'
import { ServerConfig, UserRight, VideoConstant } from '@shared/models'

const logger = debug('peertube:menu:MenuComponent')

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit {
  @ViewChild('languageChooserModal', { static: true }) languageChooserModal: LanguageChooserComponent
  @ViewChild('quickSettingsModal', { static: true }) quickSettingsModal: QuickSettingsModalComponent

  user: AuthUser
  isLoggedIn: boolean

  userHasAdminAccess = false
  helpVisible = false

  videoLanguages: string[] = []

  private languages: VideoConstant<string>[] = []
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
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private hotkeysService: HotkeysService,
    private screenService: ScreenService,
    private menuService: MenuService,
    private router: Router
  ) { }

  get isInMobileView () {
    return this.screenService.isInMobileView()
  }

  get placement () {
    if (this.isInMobileView) {
      return 'left-top auto'
    } else {
      return 'right-top auto'
    }
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)

    this.isLoggedIn = this.authService.isLoggedIn()
    if (this.isLoggedIn === true) {
      this.user = this.authService.getUser()
      this.computeVideosLink()
    }

    this.computeAdminAccess()

    this.authService.loginChangedSource.subscribe(
      status => {
        if (status === AuthStatus.LoggedIn) {
          this.isLoggedIn = true
          this.user = this.authService.getUser()

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
  }

  get language () {
    return this.languageChooserModal.getCurrentLanguage()
  }

  get nsfwPolicy () {
    if (!this.user) return

    switch (this.user.nsfwPolicy) {
      case 'do_not_list':
        return $localize`hide`

      case 'blur':
        return $localize`blur`

      case 'display':
        return $localize`display`
    }
  }

  isRegistrationAllowed () {
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

  onSameUrlRestoreScrollPosition (link: HTMLAnchorElement) {
    const linkURL = link.getAttribute('href')
    const linkHash = link.getAttribute('fragment')

    // On same url without fragment restore top scroll position
    if (!linkHash && this.router.url.includes(linkURL)) {
      window.scrollTo({
        left: 0,
        top: 0,
        behavior: 'smooth'
      })
    }

    // On same url with fragment restore anchor scroll position
    if (linkHash && this.router.url === linkURL) {
      const anchor = document.getElementById(link.getAttribute('fragment'))
      anchor.scrollIntoView({ behavior: 'smooth', inline: 'nearest' })
    }

    if (this.screenService.isInSmallView()) {
      this.menuService.toggleMenu()
    }
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
}
