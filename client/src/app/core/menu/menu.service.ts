import { fromEvent } from 'rxjs'
import { debounceTime } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { GlobalIconName } from '@app/shared/shared-icons'
import { sortObjectComparator } from '@shared/core-utils/miscs/miscs'
import { HTMLServerConfig } from '@shared/models/server'
import { ScreenService } from '../wrappers'

export type MenuLink = {
  icon: GlobalIconName
  label: string
  menuLabel: string
  path: string
  priority: number
  isHidden?: boolean
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

  buildCommonLinks (config: HTMLServerConfig) {
    let entries: MenuLink[] = [
      {
        icon: 'globe' as 'globe',
        label: $localize`Discover videos`,
        menuLabel: $localize`Discover`,
        path: '/videos/overview',
        priority: 150
      },
      {
        icon: 'trending' as 'trending',
        label: $localize`Trending videos`,
        menuLabel: $localize`Trending`,
        path: '/videos/trending',
        priority: 140
      },
      {
        icon: 'recently-added' as 'recently-added',
        label: $localize`Recently added videos`,
        menuLabel: $localize`Recently added`,
        path: '/videos/recently-added',
        priority: 130
      },
      {
        icon: 'local' as 'local',
        label: $localize`Local videos`,
        menuLabel: $localize`Local videos`,
        path: '/videos/local',
        priority: 120
      }
    ]

    if (config.homepage.enabled) {
      entries.push({
        icon: 'home' as 'home',
        label: $localize`Home`,
        menuLabel: $localize`Home`,
        path: '/home',
        priority: 160
      })
    }

    entries = entries.sort(sortObjectComparator('priority', 'desc'))

    return entries
  }

  private handleWindowResize () {
    // On touch screens, do not handle window resize event since opened menu is handled with a content overlay
    if (this.screenService.isInTouchScreen()) return

    fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => this.onResize())
  }
}
