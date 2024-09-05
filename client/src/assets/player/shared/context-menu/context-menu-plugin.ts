import videojs, { VideoJsPlayer } from 'video.js'
import { ContextMenuPluginOptions } from '../../types'
import { ContextMenu } from './context-menu'
import { getPointerPosition } from './util'

const Plugin = videojs.getPlugin('plugin')

class ContextMenuPlugin extends Plugin {
  declare options_: ContextMenuPluginOptions & videojs.MenuOptions
  declare menu: ContextMenu

  declare private onContextMenuBind: (e: TouchEvent & MouseEvent) => void

  constructor (player: videojs.Player, options: ContextMenuPluginOptions & videojs.MenuOptions) {
    super(player, options)

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

    const menu = this.menu = new ContextMenu(this.player, {
      content: this.options_.content,
      position: menuPosition
    })

    menu.on('dispose', () => {
      for (const event of [ 'click', 'tap' ]) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        videojs.off(documentEl as Element, event, menu.dispose)
      }

      this.player.removeChild(menu)
      this.menu = undefined
    })

    this.player.addChild(menu)

    const menuEl = menu.el() as HTMLElement
    const menuSize = menuEl.getBoundingClientRect()
    const bodySize = document.body.getBoundingClientRect()

    if (menuSize.right > bodySize.width || menuSize.bottom > bodySize.height) {
      menuEl.style.left = Math.floor(Math.min(
        menuPosition.left,
        this.player.currentWidth() - menu.currentWidth()
      )) + 'px'

      menuEl.style.top = Math.floor(Math.min(
        menuPosition.top,
        this.player.currentHeight() - menu.currentHeight()
      )) + 'px'
    }

    for (const event of [ 'click', 'tap' ]) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      videojs.on(documentEl as Element, event, menu.dispose)
    }
  }
}

videojs.registerPlugin('contextMenu', ContextMenuPlugin)

export { ContextMenuPlugin }

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function hasMenu (player: VideoJsPlayer) {
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
