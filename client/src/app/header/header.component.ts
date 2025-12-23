import { CommonModule } from '@angular/common'
import { Component, inject, LOCALE_ID, OnDestroy, OnInit, viewChild } from '@angular/core'
import { NavigationEnd, Router, RouterLink } from '@angular/router'
import { AuthService, AuthStatus, AuthUser, HotkeysService, MenuService, RedirectService, ScreenService, ServerService } from '@app/core'
import { NotificationDropdownComponent } from '@app/header/notification-dropdown.component'
import { getDevLocale, isOnDevLocale } from '@app/helpers'
import { QuickSettingsModalComponent } from '@app/menu/quick-settings-modal.component'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { PeertubeModalService } from '@app/shared/shared-main/peertube-modal/peertube-modal.service'
import { PluginSelectorDirective } from '@app/shared/shared-main/plugins/plugin-selector.directive'
import { LoginLinkComponent } from '@app/shared/shared-main/users/login-link.component'
import { SignupLabelComponent } from '@app/shared/shared-main/users/signup-label.component'
import { NgbDropdown, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { findAppropriateImage, getCompleteLocale, I18N_LOCALES } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, ServerConfig } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { isAndroid, isIOS, isIphone } from '@root-helpers/web-browser'
import { Subscription } from 'rxjs'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../shared/shared-main/buttons/button.component'
import { HeaderService } from './header.service'
import { SearchTypeaheadComponent } from './search-typeahead.component'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ],
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
  androidAppUrl = ''
  iosAppUrl = ''

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
    if (peertubeLocalStorage.getItem(HeaderComponent.LS_HIDE_MOBILE_MSG) === 'true') return

    if (!isAndroid() && !isIphone()) return

    this.mobileMsg = true
    document.documentElement.classList.add('mobile-app-msg')

    const host = window.location.host
    const intentConfig = this.htmlConfig.client.openInApp.android.intent
    const iosConfig = this.htmlConfig.client.openInApp.ios

    const getVideoId = (url: string) => {
      const matches = url.match(/^\/w\/([^/?;]+)/)

      if (matches) return matches[1]
    }

    const getChannelId = (url: string) => {
      const matches = url.match(/^\/c\/([^/?;]+)/)

      if (matches) return matches[1]
    }

    this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) return

      const url = event.url

      const baseAndroid = `intent://${intentConfig.host}`
      const fallbackAndroid = `#Intent;scheme=${intentConfig.scheme};S.browser_fallback_url=${intentConfig.fallbackUrl};end`

      const baseIOS = `peertube://${iosConfig.host}`

      const videoId = getVideoId(url)
      const channelId = getChannelId(url)

      if (videoId) {
        if (isAndroid()) {
          this.androidAppUrl = `${baseAndroid}/video/${videoId}?host=${host}${fallbackAndroid}`
        } else {
          this.iosAppUrl = `${baseIOS}/video/${videoId}?host=${host}`
        }

        return
      }

      if (channelId) {
        if (isAndroid()) {
          this.androidAppUrl = `${baseAndroid}/video-channel/${channelId}?host=${host}${fallbackAndroid}`
        } else {
          this.iosAppUrl = `${baseIOS}/video/${videoId}?host=${host}`
        }

        return
      }

      if (isAndroid()) {
        this.androidAppUrl = `${baseAndroid}/?host=${host}${fallbackAndroid}`
      } else {
        this.iosAppUrl = `${baseIOS}/?host=${host}`
      }
    })
  }

  hideMobileMsg () {
    this.mobileMsg = false
    document.documentElement.classList.remove('mobile-app-msg')

    peertubeLocalStorage.setItem(HeaderComponent.LS_HIDE_MOBILE_MSG, 'true')
  }

  onOpenClientClick () {
    if (!isIOS()) return

    setTimeout(() => {
      window.location.href = this.htmlConfig.client.openInApp.ios.fallbackUrl
    }, 2500)
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
