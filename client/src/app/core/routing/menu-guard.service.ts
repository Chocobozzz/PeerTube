import { Injectable } from '@angular/core'
import { CanActivate, CanDeactivate } from '@angular/router'
import { MenuService } from '../menu'
import { ScreenService } from '../wrappers'

abstract class MenuGuard implements CanActivate, CanDeactivate<any> {
  display = true
  canDeactivate = this.canActivate

  constructor (protected menu: MenuService, protected screen: ScreenService, display: boolean) {
    this.display = display
  }

  canActivate (): boolean {
    // small screens already have the site-wide onResize from screenService
    // > medium screens have enough space to fit the administrative menus
    if (!this.screen.isInMobileView() && this.screen.isInMediumView()) {
      this.menu.isMenuDisplayed = this.display
    }
    return true
  }
}

@Injectable()
export class OpenMenuGuard extends MenuGuard {
  constructor (menu: MenuService, screen: ScreenService) { super(menu, screen, true) }
}

@Injectable()
export class CloseMenuGuard extends MenuGuard {
  constructor (menu: MenuService, screen: ScreenService) { super(menu, screen, false) }
}

@Injectable()
export class MenuGuards {
  public static guards = [
    OpenMenuGuard,
    CloseMenuGuard
  ]

  static open () {
    return OpenMenuGuard
  }

  static close () {
    return CloseMenuGuard
  }
}
