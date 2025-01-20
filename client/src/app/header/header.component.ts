import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router'
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
import { ServerConfig } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { isAndroid } from '@root-helpers/web-browser'
import { Subscription } from 'rxjs'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../shared/shared-main/buttons/button.component'
import { SearchTypeaheadComponent } from './search-typeahead.component'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ],
  standalone: true,
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
  mobileAppUrl = ''

  private serverConfig: ServerConfig

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
    private route: ActivatedRoute,
    private menu: MenuService
  ) { }

  get language () {
    return this.languageChooserModal.getCurrentLanguage()
  }

  get requiresApproval () {
    return this.serverConfig.signup.requiresApproval
  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  isLoaded () {
    return this.serverConfig && (!this.loggedIn || !!this.user?.account)
  }

  isInMobileView () {
    return this.screenService.isInMobileView()
  }

  isInSmallView () {
    return this.screenService.isInSmallView()
  }

  ngOnInit () {
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
      .subscribe(config => this.serverConfig = config)

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
    if (!isAndroid()) return

    this.mobileMsg = true
    document.body.classList.add('mobile-app-msg')

    const host = window.location.host

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

      const videoId = getVideoId(url)
      if (videoId) {
        this.mobileAppUrl = `peertube:///video/${videoId}?host=${host}`
        return
      }

      const channelId = getChannelId(url)
      if (channelId) {
        this.mobileAppUrl = `peertube:///video-channel/${channelId}?host=${host}`
        return
      }

      this.mobileAppUrl = `peertube:///?host=${host}`
    })
  }

  hideMobileMsg () {
    this.mobileMsg = false
    document.body.classList.remove('mobile-app-msg')

    peertubeLocalStorage.setItem(HeaderComponent.LS_HIDE_MOBILE_MSG, 'true')
  }

  // ---------------------------------------------------------------------------

  isRegistrationAllowed () {
    if (!this.serverConfig) return false

    return this.serverConfig.signup.allowed &&
      this.serverConfig.signup.allowedForCurrentIP
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
