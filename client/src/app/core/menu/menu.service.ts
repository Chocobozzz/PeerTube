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

  private handleWindowResize () {
    // On touch screens, do not handle window resize event since opened menu is handled with a content overlay
    if (this.screenService.isInTouchScreen()) return

    fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => this.onResize())
  }
}
