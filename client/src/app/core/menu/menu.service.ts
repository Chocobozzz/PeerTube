import { fromEvent } from 'rxjs'
import { debounceTime } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ScreenService } from '../wrappers'

@Injectable()
export class MenuService {
  isMenuDisplayed = true
  isMenuChangedByUser = false
  menuWidth = 240  // should be kept equal to $menu-width

  constructor (
    private screenService: ScreenService
  ) {
    // Do not display menu on small screens
    if (this.screenService.isInSmallView()) {
      this.isMenuDisplayed = false
    }

    fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => this.onResize())
  }

  toggleMenu () {
    this.isMenuDisplayed = !this.isMenuDisplayed
    this.isMenuChangedByUser = true
  }

  onResize () {
    this.isMenuDisplayed = window.innerWidth >= 800 && !this.isMenuChangedByUser
  }
}
