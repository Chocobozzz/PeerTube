import videojs from 'video.js'
import { ContextMenuItem } from './context-menu-item'
import { ContextMenuPluginOptions } from '../../types'

const Menu = videojs.getComponent('Menu')

type ContextMenuOptions = ContextMenuPluginOptions & { position: { left: number, top: number } }

class ContextMenu extends Menu {
  declare options_: ContextMenuOptions & videojs.MenuOptions

  constructor (player: videojs.Player, options: ContextMenuOptions) {
    super(player, { ...options, menuButton: undefined })

    // Each menu component has its own `dispose` method that can be
    // safely bound and unbound to events while maintaining its context.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this.dispose = videojs.bind(this, this.dispose)

    for (const c of options.content()) {
      this.addItem(new ContextMenuItem(player, {
        label: c.label,
        listener: videojs.bind(player, c.listener)
      }))
    }
  }

  createEl () {
    const el = super.createEl()

    videojs.dom.addClass(el, 'vjs-contextmenu-ui-menu')
    el.style.left = this.options_.position.left + 'px'
    el.style.top = this.options_.position.top + 'px'

    return el
  }
}

export { ContextMenu }
