import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import {
  AuthService,
  AuthStatus,
  AuthUser,
  HooksService,
  MenuService,
  RedirectService,
  ServerService,
  UserService
} from '@app/core'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { ServerConfig, UserRight } from '@peertube/peertube-models'
import debug from 'debug'
import { of, Subscription } from 'rxjs'
import { first, map, switchMap } from 'rxjs/operators'

type MenuLink = {
  icon: GlobalIconName
  iconClass?: string

  label: string

  path: string

  isPrimaryButton?: boolean // default false

  ngClass?: string
}

type MenuSection = {
  key: string
  title: string
  links: MenuLink[]
}

const debugLogger = debug('peertube:menu:MenuComponent')

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html',
  styleUrls: [ './menu.component.scss' ],
  standalone: true,
  imports: [
    CommonModule,
    GlobalIconComponent,
    RouterLink,
    RouterLinkActive,
    NgbDropdownModule,
    ButtonComponent
  ]
})
export class MenuComponent implements OnInit, OnDestroy {
  menuSections: MenuSection[] = []
  loggedIn: boolean

  private user: AuthUser
  private canSeeVideoMakerBlock: boolean

  private serverConfig: ServerConfig

  private authSub: Subscription

  constructor (
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService,
    private hooks: HooksService,
    private menu: MenuService,
    private redirectService: RedirectService
  ) { }

  get shortDescription () {
    return this.serverService.getHTMLConfig().instance.shortDescription
  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  get collapsed () {
    return this.menu.isCollapsed()
  }

  get isOverlay () {
    return this.menu.isCollapsed()
  }

  ngOnInit () {
    this.loggedIn = this.authService.isLoggedIn()
    this.onUserStateChange()

    this.authSub = this.authService.loginChangedSource.subscribe(status => {
      if (status === AuthStatus.LoggedIn) this.loggedIn = true
      else if (status === AuthStatus.LoggedOut) this.loggedIn = false

      this.onUserStateChange()
    })

    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)
  }

  ngOnDestroy () {
    if (this.authSub) this.authSub.unsubscribe()
  }

  // ---------------------------------------------------------------------------

  toggleMenu () {
    this.menu.toggleMenu()
  }

  // ---------------------------------------------------------------------------

  private async buildMenuSections () {
    this.menuSections = []

    for (const section of [ this.buildQuickLinks(), this.buildLibraryLinks(), this.buildVideoMakerLinks(), this.buildAdminLinks() ]) {
      if (section.links.length !== 0) {
        this.menuSections.push(section)
      }
    }

    this.menuSections = await this.hooks.wrapObject(this.menuSections, 'common', 'filter:left-menu.links.create.result')
  }

  private buildQuickLinks (): MenuSection {
    const base = {
      key: 'quick-access',
      title: $localize`Quick access`,
      links: [
        {
          path: this.redirectService.getDefaultRoute(),
          icon: 'home' as GlobalIconName,
          label: $localize`Home`
        }
      ]
    }

    if (this.loggedIn) {
      base.links.push({
        path: '/videos/subscriptions',
        icon: 'subscriptions' as GlobalIconName,
        label: $localize`Subscriptions`
      })
    }

    return base
  }

  private buildLibraryLinks (): MenuSection {
    let links: MenuLink[] = []

    if (this.loggedIn) {
      links = links.concat([
        {
          path: '/my-library/video-playlists',
          icon: 'playlists' as GlobalIconName,
          label: $localize`Playlists`
        },
        {
          path: '/my-library/history/videos',
          icon: 'history' as GlobalIconName,
          label: $localize`History`
        }
      ])
    }

    return {
      key: 'my-library',
      title: $localize`My library`,
      links
    }
  }

  private buildVideoMakerLinks (): MenuSection {
    let links: MenuLink[] = []

    if (this.loggedIn && this.canSeeVideoMakerBlock) {
      links = links.concat([
        {
          path: '/my-library/video-channels',
          icon: 'channel' as GlobalIconName,
          iconClass: 'channel-icon',
          label: $localize`Channels`
        },

        {
          path: '/my-library/videos',
          icon: 'videos' as GlobalIconName,
          label: $localize`Videos`
        },

        {
          path: '/videos/upload',
          icon: 'upload' as GlobalIconName,
          label: $localize`Publish`,
          isPrimaryButton: true,
          ngClass: 'publish-button'
        }
      ])
    }

    return {
      key: 'my-video-space',
      title: $localize`My video space`,
      links
    }
  }

  private buildAdminLinks (): MenuSection {
    const links: MenuLink[] = []

    if (this.loggedIn) {
      if (this.user.hasRight(UserRight.SEE_ALL_VIDEOS)) {
        links.push({
          path: '/admin/overview',
          icon: 'overview' as GlobalIconName,
          label: $localize`Overview`
        })
      }

      if (this.user.hasRight(UserRight.MANAGE_ABUSES)) {
        links.push({
          path: '/admin/moderation',
          icon: 'moderation' as GlobalIconName,
          label: $localize`Moderation`
        })
      }

      if (this.user.hasRight(UserRight.MANAGE_CONFIGURATION)) {
        links.push({
          path: '/admin/settings',
          icon: 'config' as GlobalIconName,
          label: $localize`Settings`
        })
      }
    }

    return {
      key: 'admin',
      title: $localize`Administration`,
      links
    }
  }

  // ---------------------------------------------------------------------------

  private computeCanSeeVideoMakerBlock () {
    if (!this.loggedIn) return of(false)
    if (!this.user.hasUploadDisabled()) return of(true)

    return this.authService.userInformationLoaded
      .pipe(
        first(),
        switchMap(() => this.userService.getMyVideoQuotaUsed()),
        map(({ videoQuotaUsed }) => {
          // User already uploaded videos, so it can see the link
          if (videoQuotaUsed !== 0) return true

          // No videos, no upload so the user don't need to see the videos link
          return false
        })
      )
  }

  private onUserStateChange () {
    this.user = this.loggedIn
      ? this.authService.getUser()
      : undefined

    this.computeCanSeeVideoMakerBlock()
      .subscribe(res => {
        this.canSeeVideoMakerBlock = res

        if (this.canSeeVideoMakerBlock) debugLogger('User can see videos link.')
        else debugLogger('User cannot see videos link.')

        this.buildMenuSections()
      })
  }
}
