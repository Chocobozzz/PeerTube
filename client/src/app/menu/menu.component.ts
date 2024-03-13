import { CommonModule, ViewportScroller } from '@angular/common'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { Router, RouterLink, RouterLinkActive } from '@angular/router'
import {
  AuthService,
  AuthStatus,
  AuthUser,
  HooksService,
  HotkeysService,
  MenuSection,
  MenuService,
  RedirectService,
  ScreenService,
  ServerService,
  UserService
} from '@app/core'
import { scrollToTop } from '@app/helpers'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { InputSwitchComponent } from '@app/shared/shared-forms/input-switch.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { SignupLabelComponent } from '@app/shared/shared-main/account/signup-label.component'
import { LoginLinkComponent } from '@app/shared/shared-main/angular/login-link.component'
import { PeertubeModalService } from '@app/shared/shared-main/peertube-modal/peertube-modal.service'
import { NgbDropdown, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, ServerConfig, UserRight, UserRightType, VideoConstant } from '@peertube/peertube-models'
import * as debug from 'debug'
import { forkJoin, Subscription } from 'rxjs'
import { first, switchMap } from 'rxjs/operators'
import { LanguageChooserComponent } from './language-chooser.component'
import { NotificationComponent } from './notification.component'
import { QuickSettingsModalComponent } from './quick-settings-modal.component'

const debugLogger = debug('peertube:menu:MenuComponent')

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html',
  styleUrls: [ './menu.component.scss' ],
  standalone: true,
  imports: [
    CommonModule,
    NotificationComponent,
    ActorAvatarComponent,
    InputSwitchComponent,
    SignupLabelComponent,
    LoginLinkComponent,
    LanguageChooserComponent,
    QuickSettingsModalComponent,
    GlobalIconComponent,
    RouterLink,
    RouterLinkActive,
    NgbDropdownModule
  ]
})
export class MenuComponent implements OnInit, OnDestroy {
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

  menuSections: MenuSection[] = []

  private languages: VideoConstant<string>[] = []

  private htmlServerConfig: HTMLServerConfig
  private serverConfig: ServerConfig

  private routesPerRight: { [role in UserRightType]?: string } = {
    [UserRight.MANAGE_USERS]: '/admin/users',
    [UserRight.MANAGE_SERVER_FOLLOW]: '/admin/friends',
    [UserRight.MANAGE_ABUSES]: '/admin/moderation/abuses',
    [UserRight.MANAGE_VIDEO_BLACKLIST]: '/admin/moderation/video-blocks',
    [UserRight.MANAGE_JOBS]: '/admin/jobs',
    [UserRight.MANAGE_CONFIGURATION]: '/admin/config'
  }

  private languagesSub: Subscription
  private modalSub: Subscription
  private hotkeysSub: Subscription
  private authSub: Subscription

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

  get language () {
    return this.languageChooserModal.getCurrentLanguage()
  }

  get requiresApproval () {
    return this.serverConfig.signup.requiresApproval
  }

  ngOnInit () {
    this.htmlServerConfig = this.serverService.getHTMLConfig()
    this.currentInterfaceLanguage = this.languageChooserModal.getCurrentLanguage()

    this.isLoggedIn = this.authService.isLoggedIn()
    this.updateUserState()
    this.buildMenuSections()

    this.authSub = this.authService.loginChangedSource.subscribe(status => {
      if (status === AuthStatus.LoggedIn) {
        this.isLoggedIn = true
      } else if (status === AuthStatus.LoggedOut) {
        this.isLoggedIn = false
      }

      this.updateUserState()
      this.buildMenuSections()
    })

    this.hotkeysSub = this.hotkeysService.cheatSheetToggle
      .subscribe(isOpen => this.helpVisible = isOpen)

    this.languagesSub = forkJoin([
      this.serverService.getVideoLanguages(),
      this.authService.userInformationLoaded.pipe(first())
    ]).subscribe(([ languages ]) => {
      this.languages = languages

      this.buildUserLanguages()
    })

    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)

    this.modalSub = this.modalService.openQuickSettingsSubject
      .subscribe(() => this.openQuickSettings())
  }

  ngOnDestroy () {
    if (this.modalSub) this.modalSub.unsubscribe()
    if (this.languagesSub) this.languagesSub.unsubscribe()
    if (this.hotkeysSub) this.hotkeysSub.unsubscribe()
    if (this.authSub) this.authSub.unsubscribe()
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
    this.user.p2pEnabled = !this.user.p2pEnabled

    this.userService.updateMyProfile({ p2pEnabled: this.user.p2pEnabled })
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
    document.querySelector('nav').scrollTo(0, 0)
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
      document.querySelector('nav').scrollTo(0, 0) // Reset menu scroll to easy lock
      // eslint-disable-next-line @typescript-eslint/unbound-method
      document.querySelector('nav').addEventListener('scroll', this.onMenuScrollEvent)
    } else {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      document.querySelector('nav').removeEventListener('scroll', this.onMenuScrollEvent)
    }
  }

  private async buildMenuSections () {
    const menuSections = []

    if (this.isLoggedIn) {
      menuSections.push(
        this.menuService.buildLibraryLinks(this.user?.canSeeVideosLink)
      )
    }

    menuSections.push(
      this.menuService.buildCommonLinks(this.htmlServerConfig)
    )

    this.menuSections = await this.hooks.wrapObject(menuSections, 'common', 'filter:left-menu.links.create.result')
  }

  private buildUserLanguages () {
    if (!this.user) {
      this.videoLanguages = []
      return
    }

    if (!this.user.videoLanguages) {
      this.videoLanguages = [ $localize`any language` ]
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
    if (!this.isLoggedIn) return

    this.authService.userInformationLoaded
      .pipe(
        switchMap(() => this.user.computeCanSeeVideosLink(this.userService.getMyVideoQuotaUsed()))
      ).subscribe(res => {
        if (res === true) debugLogger('User can see videos link.')
        else debugLogger('User cannot see videos link.')
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

  private updateUserState () {
    this.user = this.isLoggedIn
      ? this.authService.getUser()
      : undefined

    this.computeAdminAccess()
    this.computeNSFWPolicy()
    this.computeVideosLink()
  }
}
