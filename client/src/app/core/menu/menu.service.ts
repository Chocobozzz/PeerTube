import { fromEvent } from 'rxjs'
import { debounceTime } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { GlobalIconName } from '@app/shared/shared-icons'
import { HTMLServerConfig } from '@shared/models/server'
import { ScreenService } from '../wrappers'

export type MenuLink = {
  icon: GlobalIconName

  label: string
  // Used by the left menu for example
  shortLabel: string

  path: string
}

export type MenuSection = {
  key: string
  title: string
  links: MenuLink[]
}

@Injectable()
export class MenuService {
  isMenuDisplayed = true
  isMenuChangedByUser = false
  menuWidth = 240  // should be kept equal to $menu-width

  constructor (
    private screenService: ScreenService
  ) {
    // Do not display menu on small or touch screens
    if (this.screenService.isInSmallView() || this.screenService.isInTouchScreen()) {
      this.setMenuDisplay(false)
    }

    this.handleWindowResize()
  }

  toggleMenu () {
    this.setMenuDisplay(!this.isMenuDisplayed)
    this.isMenuChangedByUser = true
  }

  isDisplayed () {
    return this.isMenuDisplayed
  }

  setMenuDisplay (display: boolean) {
    this.isMenuDisplayed = display

    if (!this.screenService.isInTouchScreen()) return

    // On touch screens, lock body scroll and display content overlay when memu is opened
    if (this.isMenuDisplayed) {
      document.body.classList.add('menu-open')
      this.screenService.onFingerSwipe('left', () => { this.setMenuDisplay(false) })
      return
    }

    document.body.classList.remove('menu-open')
  }

  onResize () {
    this.isMenuDisplayed = window.innerWidth >= 800 && !this.isMenuChangedByUser
  }

  buildLibraryLinks (userCanSeeVideosLink: boolean): MenuSection {
    let links: MenuLink[] = []

    if (userCanSeeVideosLink) {
      links.push({
        path: '/my-library/videos',
        icon: 'videos' as GlobalIconName,
        shortLabel: $localize`Videos`,
        label: $localize`My videos`
      })
    }

    links = links.concat([
      {
        path: '/my-library/video-playlists',
        icon: 'playlists' as GlobalIconName,
        shortLabel: $localize`Playlists`,
        label: $localize`My playlists`
      },
      {
        path: '/videos/subscriptions',
        icon: 'subscriptions' as GlobalIconName,
        shortLabel: $localize`Subscriptions`,
        label: $localize`My subscriptions`
      },
      {
        path: '/my-library/history/videos',
        icon: 'history' as GlobalIconName,
        shortLabel: $localize`History`,
        label: $localize`My history`
      }
    ])

    return {
      key: 'in-my-library',
      title: 'In my library',
      links
    }
  }

  buildCommonLinks (config: HTMLServerConfig): MenuSection {
    let links: MenuLink[] = []

    if (config.homepage.enabled) {
      links.push({
        icon: 'home' as 'home',
        label: $localize`Home`,
        shortLabel: $localize`Home`,
        path: '/home'
      })
    }

    links = links.concat([
      {
        icon: 'globe' as 'globe',
        label: $localize`Discover videos`,
        shortLabel: $localize`Discover`,
        path: '/videos/overview'
      },
      {
        icon: 'trending' as 'trending',
        label: $localize`Trending videos`,
        shortLabel: $localize`Trending`,
        path: '/videos/trending'
      },
      {
        icon: 'recently-added' as 'recently-added',
        label: $localize`Recently added videos`,
        shortLabel: $localize`Recently added`,
        path: '/videos/recently-added'
      },
      {
        icon: 'local' as 'local',
        label: $localize`Local videos`,
        shortLabel: $localize`Local videos`,
        path: '/videos/local'
      }
    ])

    return {
      key: 'on-instance',
      title: $localize`ON ${config.instance.name}`,
      links
    }
  }

  private handleWindowResize () {
    // On touch screens, do not handle window resize event since opened menu is handled with a content overlay
    if (this.screenService.isInTouchScreen()) return

    fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => this.onResize())
  }
}
