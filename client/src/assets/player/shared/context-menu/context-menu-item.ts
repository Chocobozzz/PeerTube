import videojs from 'video.js'
import { ContextMenuItemOptions } from '../../types'

const MenuItem = videojs.getComponent('MenuItem')

class ContextMenuItem extends MenuItem {
  declare options_: ContextMenuItemOptions

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (player: videojs.Player, options: ContextMenuItemOptions) {
    super(player, options)
  }

  handleClick (e: videojs.EventTarget.Event) {
    super.handleClick(e)

    this.options_.listener(e)

    // Close the containing menu after the call stack clears.
    setTimeout(() => {
      this.player().contextMenu().menu.dispose()
    }, 1)
  }

  createEl (type: string, props?: any, attrs?: any) {
    const el = super.createEl(type, props, attrs)

    const newEl = videojs.dom.createEl('span')

    newEl.innerHTML = `<span class="vjs-menu-item-text">${this.localize(this.options_.label)}</span>`

    el.replaceChild(newEl, el.querySelector('.vjs-menu-item-text'))

    return el
  }
}

export { ContextMenuItem }
