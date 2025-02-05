import videojs from 'video.js'

const Menu = videojs.getComponent('Menu')
const Component = videojs.getComponent('Component')

// Default menu doesn't check if the child is disabled/hidden

class MenuFocusFixed extends Menu {
  declare private focusedChild_: number

  handleKeyDown (event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      this.trigger('escaped-key')
      return
    }

    // FIXME: super misses handleKeyDown
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return super.handleKeyDown(event)
  }

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

  focus (item = 0): void {
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

Component.registerComponent('MenuFocusFixed', MenuFocusFixed)
export { MenuFocusFixed }
