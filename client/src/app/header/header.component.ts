import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject, LOCALE_ID, OnDestroy, OnInit, viewChild } from '@angular/core'
import { NavigationEnd, Router, RouterLink } from '@angular/router'
import { AuthService, AuthStatus, AuthUser, HotkeysService, MenuService, RedirectService, ScreenService, ServerService } from '@app/core'
import { NotificationDropdownComponent } from '@app/header/notification-dropdown.component'
import {
  buildMobileAppLoginPath,
  buildMobileAppUrl,
  canOpenMobileApp,
  getDevLocale,
  isOnDevLocale,
  openMobileAppFallbackOnIOS
} from '@app/helpers'
import { QuickSettingsModalComponent } from '@app/menu/quick-settings-modal.component'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { PeertubeModalService } from '@app/shared/shared-main/peertube-modal/peertube-modal.service'
import { PluginSelectorDirective } from '@app/shared/shared-main/plugins/plugin-selector.directive'
import { LoginLinkComponent } from '@app/shared/shared-main/users/login-link.component'
import { SignupLabelComponent } from '@app/shared/shared-main/users/signup-label.component'
import { NgbDropdown, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { findAppropriateImage, getCompleteLocale, I18N_LOCALES } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, ServerConfig, UserSignupClient } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { Subscription } from 'rxjs'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../shared/shared-main/buttons/button.component'
import { HeaderService } from './header.service'
import { SearchTypeaheadComponent } from './search-typeahead.component'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    NotificationDropdownComponent,
    ActorAvatarComponent,
    PluginSelectorDirective,
    SignupLabelComponent,
    LoginLinkComponent,
    QuickSettingsModalComponent,
    GlobalIconComponent,
    RouterLink,
    NgbDropdownModule,
    SearchTypeaheadComponent,
    RouterLink,
    GlobalIconComponent,
    ButtonComponent
  ]
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService)
  private serverService = inject(ServerService)
  private redirectService = inject(RedirectService)
  private hotkeysService = inject(HotkeysService)
  private screenService = inject(ScreenService)
  private modalService = inject(PeertubeModalService)
  private router = inject(Router)
  private menu = inject(MenuService)
  private headerService = inject(HeaderService)
  private localeId = inject(LOCALE_ID)

  private static LS_HIDE_MOBILE_MSG = 'hide-mobile-msg'

  readonly quickSettingsModal = viewChild<QuickSettingsModalComponent>('quickSettingsModal')
  readonly dropdown = viewChild<NgbDropdown>('dropdown')

  user: AuthUser
  loggedIn: boolean

  hotkeysHelpVisible = false

  mobileMsg = false
  // Propose to log in in the app instead of opening the current page in the app
  mobileMsgLogin = false
  // Displayed even if the user hid the message
  mobileMsgForced = false
  mobileAppUrl = ''

  searchHidden = false

  private config: ServerConfig
  private htmlConfig: HTMLServerConfig

  private quickSettingsModalSub: Subscription
  private getSearchHiddenSub: Subscription
  private hotkeysSub: Subscription
  private authSub: Subscription

  get currentInterfaceLanguage () {
    const english = 'English'
    const locale = isOnDevLocale()
      ? getDevLocale()
      : getCompleteLocale(this.localeId)

    if (locale) return I18N_LOCALES[locale as keyof typeof I18N_LOCALES] || english

    return english
  }

  get requiresApproval () {
    return this.config.signup.requiresApproval
  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  isInstanceNameDisplayed () {
    return this.serverService.getHTMLConfig().client.header.hideInstanceName !== true
  }

  isLoaded () {
    return this.config && (!this.loggedIn || !!this.user?.account)
  }

  isInMobileView () {
    return this.screenService.isInMobileView()
  }

  isInSmallView () {
    return this.screenService.isInSmallView()
  }

  getLogoUrl () {
    const logos = this.serverService.getHTMLConfig().instance.logo

    if (this.isInMobileView()) {
      return findAppropriateImage(logos.filter(l => l.type === 'header-square'), 36)?.fileUrl
    }

    return findAppropriateImage(logos.filter(l => l.type === 'header-wide'), 36)?.fileUrl
  }

  ngOnInit () {
    this.htmlConfig = this.serverService.getHTMLConfig()

    this.loggedIn = this.authService.isLoggedIn()
    this.updateUserState()

    this.authSub = this.authService.loginChangedSource.subscribe(status => {
      if (status === AuthStatus.LoggedIn) {
        this.loggedIn = true
      } else if (status === AuthStatus.LoggedOut) {
        this.loggedIn = false
      }

      this.updateUserState()
    })

    this.hotkeysSub = this.hotkeysService.cheatSheetToggle
      .subscribe(isOpen => this.hotkeysHelpVisible = isOpen)

    this.serverService.getConfig()
      .subscribe(config => this.config = config)

    this.quickSettingsModalSub = this.modalService.openQuickSettingsSubject
      .subscribe(() => this.openQuickSettings())

    this.getSearchHiddenSub = this.headerService.getSearchHiddenObs()
      .subscribe(hidden => {
        if (hidden) document.documentElement.classList.add('global-search-hidden')
        else document.documentElement.classList.remove('global-search-hidden')

        this.searchHidden = hidden
      })

    this.setupMobileMsg()
  }

  ngOnDestroy () {
    if (this.quickSettingsModalSub) this.quickSettingsModalSub.unsubscribe()
    if (this.hotkeysSub) this.hotkeysSub.unsubscribe()
    if (this.authSub) this.authSub.unsubscribe()
    if (this.getSearchHiddenSub) this.getSearchHiddenSub.unsubscribe()
  }

  // ---------------------------------------------------------------------------

  getDefaultRoute () {
    return this.redirectService.getDefaultRoute()
  }

  getDefaultRouteQuery () {
    return this.redirectService.getDefaultRouteQuery()
  }

  // ---------------------------------------------------------------------------

  private setupMobileMsg () {
    if (!this.isInMobileView()) return

    const openInAppConfig = this.htmlConfig.client.openInApp
    if (!canOpenMobileApp(openInAppConfig)) return

    const host = window.location.host

    const getVideoId = (url: string) => {
      const matches = url.match(/^\/w\/([^/?;]+)/)

      if (matches) return matches[1]
    }

    const getChannelId = (url: string) => {
      const matches = url.match(/^\/c\/([^/?;]+)/)

      if (matches) return matches[1]
    }

    // "Registration accepted" email link sent after a signup from the app
    const isSignupFromApp = (url: string) => {
      const { queryParams } = this.router.parseUrl(url)

      return queryParams.signupClient === UserSignupClient.PEERTUBE_APP && !!queryParams.username
    }

    // Pages where we propose to log in in the app instead of opening the current page
    // The email verification page has its own call to action after a successful verification
    const getLoginAppPath = (url: string) => {
      if (url !== '/login' && !url.startsWith('/login?')) return undefined

      return buildMobileAppLoginPath({ afterSignup: false, username: this.router.parseUrl(url).queryParams.username })
    }

    const getAppPath = (url: string) => {
      const videoId = getVideoId(url)
      if (videoId) return `/video/${videoId}?host=${host}`

      const channelId = getChannelId(url)
      if (channelId) return `/video-channel/${channelId}?host=${host}`

      return `/?host=${host}`
    }

    this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) return

      const url = event.url

      const loginAppPath = getLoginAppPath(url)
      const appPath = loginAppPath ?? getAppPath(url)

      this.mobileMsgLogin = !!loginAppPath
      this.mobileAppUrl = buildMobileAppUrl(openInAppConfig, appPath)

      // Always propose to log in in the app after a signup from the app, even if the user hid the message
      this.mobileMsgForced = this.mobileMsgLogin && isSignupFromApp(url)
      this.setMobileMsgDisplayed(this.mobileMsgForced || peertubeLocalStorage.getItem(HeaderComponent.LS_HIDE_MOBILE_MSG) !== 'true')
    })
  }

  private setMobileMsgDisplayed (displayed: boolean) {
    this.mobileMsg = displayed

    if (displayed) document.documentElement.classList.add('mobile-app-msg')
    else document.documentElement.classList.remove('mobile-app-msg')
  }

  hideMobileMsg () {
    this.setMobileMsgDisplayed(false)

    if (!this.mobileMsgForced) peertubeLocalStorage.setItem(HeaderComponent.LS_HIDE_MOBILE_MSG, 'true')
  }

  onOpenClientClick () {
    openMobileAppFallbackOnIOS(this.htmlConfig.client.openInApp)
  }

  // ---------------------------------------------------------------------------

  isRegistrationAllowed () {
    if (!this.config) return false

    return this.config.signup.allowed &&
      this.config.signup.allowedForCurrentIP
  }

  logout (event: Event) {
    event.preventDefault()

    this.authService.logout()
    // Redirect to home page
    this.redirectService.redirectToHomepage()
  }

  openQuickSettings () {
    this.quickSettingsModal().show()
  }

  openHotkeysCheatSheet () {
    this.hotkeysService.cheatSheetToggle.next(!this.hotkeysHelpVisible)
  }

  toggleMenu () {
    this.menu.toggleMenu()
  }

  private updateUserState () {
    this.user = this.loggedIn
      ? this.authService.getUser()
      : undefined
  }
}
