import videojs from 'video.js'
import { VideojsMenu } from '../../types'

const Menu = videojs.getComponent('Menu') as typeof VideojsMenu

// Default menu doesn't check if the child is disabled/hidden

class MenuFocusFixed extends Menu {
  declare focusedChild_: number

  stepForward () {
    let stepChild = 0

    if (this.focusedChild_ !== undefined) {
      stepChild = this.focusedChild_ + 1
    }
    this.focus(stepChild)
  }

  stepBack () {
    let stepChild = 0

    if (this.focusedChild_ !== undefined) {
      stepChild = this.focusedChild_ - 1
    }
    this.focus(stepChild)
  }

  focus (item?: number): void {
    // Reset focus
    if (item === undefined) {
      this.focusedChild_ = -1
      item = 0
    }

    this._focus(item)
  }

  private _focus (item: number) {
    const children = this.children().slice()
    const haveTitle = children.length && children[0].hasClass('vjs-menu-title')

    if (haveTitle) {
      children.shift()
    }

    if (children.length > 0) {
      if (item < 0) {
        item = 0
      } else if (item >= children.length) {
        item = children.length - 1
      }

      const el = children[item].el() as HTMLElement

      if (el.classList.contains('vjs-hidden')) {
        if (this.focusedChild_ < item) {
          if (item === children.length - 1) return

          return this.focus(item + 1)
        } else {
          if (item === 0) return

          return this.focus(item - 1)
        }
      }

      this.focusedChild_ = item

      el.focus()
    }
  }
}

videojs.registerComponent('MenuFocusFixed', MenuFocusFixed)
export { MenuFocusFixed }
