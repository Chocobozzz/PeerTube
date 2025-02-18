import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { NavigationEnd, Router, RouterLink } from '@angular/router'
import {
  AuthService,
  AuthStatus,
  AuthUser,
  HotkeysService,
  MenuService,
  RedirectService,
  ScreenService,
  ServerService
} from '@app/core'
import { NotificationDropdownComponent } from '@app/header/notification-dropdown.component'
import { LanguageChooserComponent } from '@app/menu/language-chooser.component'
import { QuickSettingsModalComponent } from '@app/menu/quick-settings-modal.component'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { PeertubeModalService } from '@app/shared/shared-main/peertube-modal/peertube-modal.service'
import { PluginSelectorDirective } from '@app/shared/shared-main/plugins/plugin-selector.directive'
import { LoginLinkComponent } from '@app/shared/shared-main/users/login-link.component'
import { SignupLabelComponent } from '@app/shared/shared-main/users/signup-label.component'
import { NgbDropdown, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, ServerConfig } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { isAndroid, isIOS, isIphone } from '@root-helpers/web-browser'
import { Subscription } from 'rxjs'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../shared/shared-main/buttons/button.component'
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
    LanguageChooserComponent,
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
  private static LS_HIDE_MOBILE_MSG = 'hide-mobile-msg'

  @ViewChild('languageChooserModal', { static: true }) languageChooserModal: LanguageChooserComponent
  @ViewChild('quickSettingsModal', { static: true }) quickSettingsModal: QuickSettingsModalComponent
  @ViewChild('dropdown') dropdown: NgbDropdown

  user: AuthUser
  loggedIn: boolean

  hotkeysHelpVisible = false

  currentInterfaceLanguage: string

  mobileMsg = false
  androidAppUrl = ''
  iosAppUrl = ''

  private config: ServerConfig
  private htmlConfig: HTMLServerConfig

  private quickSettingsModalSub: Subscription
  private hotkeysSub: Subscription
  private authSub: Subscription

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private hotkeysService: HotkeysService,
    private screenService: ScreenService,
    private modalService: PeertubeModalService,
    private router: Router,
    private menu: MenuService
  ) { }

  get language () {
    return this.languageChooserModal.getCurrentLanguage()
  }

  get requiresApproval () {
    return this.config.signup.requiresApproval
  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
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

  ngOnInit () {
    this.htmlConfig = this.serverService.getHTMLConfig()
    this.currentInterfaceLanguage = this.languageChooserModal.getCurrentLanguage()

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

    this.setupMobileMsg()
  }

  ngOnDestroy () {
    if (this.quickSettingsModalSub) this.quickSettingsModalSub.unsubscribe()
    if (this.hotkeysSub) this.hotkeysSub.unsubscribe()
    if (this.authSub) this.authSub.unsubscribe()
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
    document.body.classList.add('mobile-app-msg')

    const host = window.location.host
    const intentConfig = this.htmlConfig.client.openInApp.android.intent
    const iosConfig = this.htmlConfig.client.openInApp.ios

    const getVideoId = (url: string) => {
      const matches = url.match(/^\/w\/([^/]+)$/)

      if (matches) return matches[1]
    }

    const getChannelId = (url: string) => {
      const matches = url.match(/^\/c\/([^/]+)/)

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
    document.body.classList.remove('mobile-app-msg')

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

  openLanguageChooser () {
    this.languageChooserModal.show()
  }

  openQuickSettings () {
    this.quickSettingsModal.show()
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
