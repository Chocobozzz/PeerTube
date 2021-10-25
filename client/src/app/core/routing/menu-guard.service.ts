import { Injectable } from '@angular/core'
import { CanActivate, CanDeactivate } from '@angular/router'
import { MenuService } from '../menu'
import { ScreenService } from '../wrappers'

abstract class MenuGuard implements CanActivate, CanDeactivate<any> {
  canDeactivate = this.canActivate

  constructor (protected menu: MenuService, protected screen: ScreenService, protected display: boolean) {

  }

  canActivate (): boolean {
    // small screens already have the site-wide onResize from screenService
    // > medium screens have enough space to fit the administrative menus
    if (!this.screen.isInMobileView() && this.screen.isInMediumView()) {
      this.menu.setMenuDisplay(this.display)
    }

    return true
  }
}

@Injectable()
export class OpenMenuGuard extends MenuGuard {
  constructor (menu: MenuService, screen: ScreenService) {
    super(menu, screen, true)
  }
}

@Injectable()
export class OpenMenuAlwaysGuard extends MenuGuard {
  constructor (menu: MenuService, screen: ScreenService) {
    super(menu, screen, true)
  }

  canActivate (): boolean {
    this.menu.setMenuDisplay(this.display)

    return true
  }
}

@Injectable()
export class CloseMenuGuard extends MenuGuard {
  constructor (menu: MenuService, screen: ScreenService) {
    super(menu, screen, false)
  }
}

@Injectable()
export class CloseMenuAlwaysGuard extends MenuGuard {
  constructor (menu: MenuService, screen: ScreenService) {
    super(menu, screen, false)
  }

  canActivate (): boolean {
    this.menu.setMenuDisplay(this.display)
    return true
  }
}

@Injectable()
export class MenuGuards {
  public static guards = [
    OpenMenuGuard,
    OpenMenuAlwaysGuard,
    CloseMenuGuard,
    CloseMenuAlwaysGuard
  ]

  static open (always?: boolean) {
    return always
      ? OpenMenuAlwaysGuard
      : OpenMenuGuard
  }

  static close (always?: boolean) {
    return always
      ? CloseMenuAlwaysGuard
      : CloseMenuGuard
  }
}
