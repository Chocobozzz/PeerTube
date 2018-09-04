import { Component, OnInit, ViewChild } from '@angular/core'
import { UserRight } from '../../../../shared/models/users/user-right.enum'
import { AuthService, AuthStatus, RedirectService, ServerService } from '../core'
import { User } from '../shared/users/user.model'
import { LanguageChooserComponent } from '@app/menu/language-chooser.component'
import { Hotkey, HotkeysService } from 'angular2-hotkeys'

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html',
  styleUrls: [ './menu.component.scss' ]
})
export class MenuComponent implements OnInit {
  @ViewChild('languageChooserModal') languageChooserModal: LanguageChooserComponent

  user: User
  isLoggedIn: boolean
  userHasAdminAccess = false
  hotkeys: Hotkey[]

  private routesPerRight = {
    [UserRight.MANAGE_USERS]: '/admin/users',
    [UserRight.MANAGE_SERVER_FOLLOW]: '/admin/friends',
    [UserRight.MANAGE_VIDEO_ABUSES]: '/admin/video-abuses',
    [UserRight.MANAGE_VIDEO_BLACKLIST]: '/admin/video-blacklist'
  }
  private theme = document.querySelector('body')
  private previousTheme = { }

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private hotkeysService: HotkeysService
  ) {}

  ngOnInit () {
    this.isLoggedIn = this.authService.isLoggedIn()
    if (this.isLoggedIn === true) this.user = this.authService.getUser()
    this.computeIsUserHasAdminAccess()

    this.authService.loginChangedSource.subscribe(
      status => {
        if (status === AuthStatus.LoggedIn) {
          this.isLoggedIn = true
          this.user = this.authService.getUser()
          this.computeIsUserHasAdminAccess()
          console.log('Logged in.')
        } else if (status === AuthStatus.LoggedOut) {
          this.isLoggedIn = false
          this.user = undefined
          this.computeIsUserHasAdminAccess()
          console.log('Logged out.')
        } else {
          console.error('Unknown auth status: ' + status)
        }
      }
    )

    // initialise the alternative theme with dark theme colors
    this.previousTheme['mainBackgroundColor'] = '#111111'
    this.previousTheme['mainForegroundColor'] = '#fff'
    this.previousTheme['submenuColor'] = 'rgb(32,32,32)'
    this.previousTheme['inputColor'] = 'gray'
    this.previousTheme['inputPlaceholderColor'] = '#fff'

    this.hotkeys = [
      new Hotkey('T', (event: KeyboardEvent): boolean => {
        this.toggleDarkTheme()
        return false
      }, undefined, 'Toggle Dark theme')
    ]
    this.hotkeysService.add(this.hotkeys)
  }

  isRegistrationAllowed () {
    return this.serverService.getConfig().signup.allowed &&
           this.serverService.getConfig().signup.allowedForCurrentIP
  }

  getFirstAdminRightAvailable () {
    const user = this.authService.getUser()
    if (!user) return undefined

    const adminRights = [
      UserRight.MANAGE_USERS,
      UserRight.MANAGE_SERVER_FOLLOW,
      UserRight.MANAGE_VIDEO_ABUSES,
      UserRight.MANAGE_VIDEO_BLACKLIST
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

  toggleDarkTheme () {
    // switch properties
    this.switchProperty('mainBackgroundColor')
    this.switchProperty('mainForegroundColor')
    this.switchProperty('submenuColor')
    this.switchProperty('inputColor')
    this.switchProperty('inputPlaceholderColor')
  }

  private switchProperty (property, newValue?) {
    const propertyOldvalue = window.getComputedStyle(this.theme).getPropertyValue('--' + property)
    this.theme.style.setProperty('--' + property, (newValue) ? newValue : this.previousTheme[property])
    this.previousTheme[property] = propertyOldvalue
  }

  private computeIsUserHasAdminAccess () {
    const right = this.getFirstAdminRightAvailable()

    this.userHasAdminAccess = right !== undefined
  }
}
