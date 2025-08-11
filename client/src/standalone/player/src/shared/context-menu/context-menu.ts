import videojs from 'video.js'
import { ContextMenuPluginOptions, VideojsMenu, VideojsMenuOptions, VideojsPlayer } from '../../types'
import { ContextMenuItem } from './context-menu-item'

const Menu = videojs.getComponent('Menu') as typeof VideojsMenu

type ContextMenuOptions = ContextMenuPluginOptions & { position: { left: number, top: number } }

class ContextMenu extends Menu {
  declare options_: ContextMenuOptions & VideojsMenuOptions

  constructor (player: VideojsPlayer, options: ContextMenuOptions) {
    super(player, { ...options, menuButton: undefined })

    // TODO: explain why we need this (I don't understand it)
    this.dispose = this.dispose.bind(this)

    for (const c of options.content()) {
      this.addItem(
        new ContextMenuItem(player, {
          label: c.label,
          listener: c.listener.bind(player)
        })
      )
    }
  }

  createEl () {
    const el = super.createEl() as HTMLElement

    videojs.dom.addClass(el, 'vjs-contextmenu-ui-menu')
    el.style.left = this.options_.position.left + 'px'
    el.style.top = this.options_.position.top + 'px'

    return el
  }
}

export { ContextMenu }
