import { Injectable, inject } from '@angular/core'
import debug from 'debug'
import { fromEvent } from 'rxjs'
import { debounceTime } from 'rxjs/operators'
import { PeerTubeRouterService } from '../routing'
import { LocalStorageService, ScreenService } from '../wrappers'

const debugLogger = debug('peertube:menu')

@Injectable()
export class MenuService {
  private screenService = inject(ScreenService)
  private localStorageService = inject(LocalStorageService)
  private peertubeRouterService = inject(PeerTubeRouterService)

  private static LS_MENU_COLLAPSED = 'menu-collapsed'

  private menuCollapsed = false
  private menuChangedByUser = false

  private collapsedBeforeUrl: boolean

  constructor () {
    // Do not display menu on small screens
    if (this.screenService.isInMenuOverlayView() || this.hasMenuCollapsedByUrl(window.location.pathname)) {
      this.setMenuCollapsed(true)
    } else {
      this.setMenuCollapsed(this.localStorageService.getItem(MenuService.LS_MENU_COLLAPSED) === 'true')
      this.menuChangedByUser = this.menuCollapsed
    }

    this.handleWindowResize()

    this.peertubeRouterService.getNavigationEndEvents()
      .subscribe(e => {
        if (this.hasMenuCollapsedByUrl(e.url) || this.hasMenuCollapsedByUrl(e.urlAfterRedirects)) {
          this.collapseByUrl()
          return
        }

        if (this.collapsedBeforeUrl !== undefined) {
          this.setMenuCollapsed(this.collapsedBeforeUrl)
          this.collapsedBeforeUrl = undefined
        }
      })
  }

  private hasMenuCollapsedByUrl (url: string) {
    const collapsedBaseUrls = [
      '/videos/publish',
      '/videos/manage/',
      '/admin/settings/config',
      '/my-library/video-channels/manage',
      '/my-library/video-channels/create'
    ]

    for (const collapsedBaseUrl of collapsedBaseUrls) {
      if (url.startsWith(collapsedBaseUrl)) {
        debugLogger('Menu should be collapsed by URL ' + url)

        return true
      }
    }

    return false
  }

  private collapseByUrl () {
    if (this.menuCollapsed) return

    this.collapsedBeforeUrl = this.menuCollapsed
    this.setMenuCollapsed(true)
  }

  toggleMenu () {
    this.setMenuCollapsed(!this.menuCollapsed)
    this.menuChangedByUser = true

    this.localStorageService.setItem(MenuService.LS_MENU_COLLAPSED, this.menuCollapsed + '')
  }

  isCollapsed () {
    return this.menuCollapsed
  }

  setMenuCollapsed (collapsed: boolean) {
    this.menuCollapsed = collapsed

    if (this.menuCollapsed) {
      document.body.classList.remove('menu-open')
    } else {
      document.body.classList.add('menu-open')
    }
  }

  onResize () {
    if (this.screenService.isInSmallView() && !this.menuChangedByUser) {
      this.setMenuCollapsed(true)
    }
  }

  // ---------------------------------------------------------------------------

  private handleWindowResize () {
    // On touch screens, do not handle window resize event since opened menu is handled with a content overlay
    if (this.screenService.isInTouchScreen()) return

    fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => this.onResize())
  }
}
