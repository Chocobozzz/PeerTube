import videojs from 'video.js'
import { ContextMenuPluginOptions, VideojsMenuItemOptions, VideojsPlayer, VideojsPlugin } from '../../types'
import { ContextMenu } from './context-menu'
import { getPointerPosition } from './util'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

class ContextMenuPlugin extends Plugin {
  declare options_: ContextMenuPluginOptions & VideojsMenuItemOptions
  declare menu: ContextMenu

  declare private onContextMenuBind: (e: TouchEvent & MouseEvent) => void

  constructor (player: VideojsPlayer, options: ContextMenuPluginOptions & VideojsMenuItemOptions) {
    super(player)

    this.options_ = options

    // If we have already invoked the plugin, teardown before setting up again.
    if (this.menu) {
      this.menu.dispose()
      this.player.off('contextmenu', this.onContextMenuBind)
    }

    this.onContextMenuBind = this.onContextMenu.bind(this)
    this.player.on('contextmenu', this.onContextMenuBind)
    this.player.ready(() => this.player.addClass('vjs-contextmenu-ui'))
  }

  private onContextMenu (e: TouchEvent & MouseEvent) {
    // If this event happens while the custom menu is open, close it and do
    // nothing else. This will cause native contextmenu events to be intercepted
    // once again; so, the next time a contextmenu event is encountered, we'll
    // open the custom menu.
    if (hasMenu(this.player)) {
      this.menu.dispose()
      return
    }

    if (excludeElements(e.target as HTMLElement)) return

    // Calculate the positioning of the menu based on the player size and
    // triggering event.
    const pointerPosition = getPointerPosition(this.player.el() as HTMLElement, e)
    const playerSize = this.player.el().getBoundingClientRect()
    const menuPosition = findMenuPosition(pointerPosition, playerSize)
    // A workaround for Firefox issue  where "oncontextmenu" event
    // leaks "click" event to document https://bugzilla.mozilla.org/show_bug.cgi?id=990614
    const documentEl = (videojs.browser as any).IS_FIREFOX ? document.documentElement : document

    e.preventDefault()

    this.menu = new ContextMenu(this.player, {
      content: this.options_.content,
      position: menuPosition
    })

    this.menu.on('dispose', () => {
      for (const event of [ 'click', 'tap' ]) {
        videojs.off(documentEl as Element, event, this.menu.dispose)
      }

      this.player.removeChild(this.menu)
      this.menu = undefined
    })

    this.player.addChild(this.menu)

    const menuEl = this.menu.el() as HTMLElement
    const menuSize = menuEl.getBoundingClientRect()
    const bodySize = document.body.getBoundingClientRect()

    if (menuSize.right > bodySize.width || menuSize.bottom > bodySize.height) {
      menuEl.style.left = Math.floor(Math.min(
        menuPosition.left,
        this.player.currentWidth() - this.menu.currentWidth()
      )) + 'px'

      menuEl.style.top = Math.floor(Math.min(
        menuPosition.top,
        this.player.currentHeight() - this.menu.currentHeight()
      )) + 'px'
    }

    for (const event of [ 'click', 'tap' ]) {
      videojs.on(documentEl as Element, event, this.menu.dispose)
    }
  }
}

videojs.registerPlugin('contextMenu', ContextMenuPlugin)

export { ContextMenuPlugin }

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function hasMenu (player: VideojsPlayer) {
  if (!player.usingPlugin('contextMenu')) return false

  return !!player.contextMenu().menu?.el()
}

function excludeElements (targetEl: HTMLElement) {
  const tagName = targetEl.tagName.toLowerCase()

  return tagName === 'input' || tagName === 'textarea'
}

function findMenuPosition (pointerPosition: { x?: number, y?: number }, playerSize: { height: number, width: number }) {
  return {
    left: Math.round(playerSize.width * pointerPosition.x),
    top: Math.round(playerSize.height - (playerSize.height * pointerPosition.y))
  }
}
