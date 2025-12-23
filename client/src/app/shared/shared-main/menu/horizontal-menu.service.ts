import { Injectable } from '@angular/core'

@Injectable()
export class HorizontalMenuService {
  private menuHidden = false

  isMenuHidden () {
    return this.menuHidden
  }

  setMenuHidden (hidden: boolean) {
    this.menuHidden = hidden
  }
}
