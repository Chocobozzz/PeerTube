import videojs from 'video.js'
import { toTitleCase } from '../common'
import { SettingsDialog } from './settings-dialog'
import { SettingsMenuItem } from './settings-menu-item'
import { SettingsPanel } from './settings-panel'
import { SettingsPanelChild } from './settings-panel-child'
import { MenuFocusFixed } from './menu-focus-fixed'

const Button = videojs.getComponent('Button')
const Component = videojs.getComponent('Component')

export interface SettingsButtonOptions extends videojs.ComponentOptions {
  entries: any[]
  setup?: {
    maxHeightOffset: number
  }
}

class SettingsButton extends Button {
  declare dialog: SettingsDialog
  declare dialogEl: HTMLElement
  declare menu: MenuFocusFixed
  declare panel: SettingsPanel
  declare panelChild: SettingsPanelChild

  declare addSettingsItemHandler: typeof SettingsButton.prototype.onAddSettingsItem
  declare disposeSettingsItemHandler: typeof SettingsButton.prototype.onDisposeSettingsItem
  declare documentClickHandler: typeof SettingsButton.prototype.onDocumentClick
  declare userInactiveHandler: typeof SettingsButton.prototype.onUserInactive

  declare private settingsButtonOptions: SettingsButtonOptions

  constructor (player: videojs.Player, options?: SettingsButtonOptions) {
    super(player, options)

    this.settingsButtonOptions = options

    ;(this as any).controlText('Settings')

    this.dialog = (this as any).player().addChild('settingsDialog')
    this.dialogEl = (this.dialog as any).el() as HTMLElement
    this.menu = null
    this.panel = (this.dialog as any).addChild('settingsPanel')
    this.panelChild = (this.panel as any).addChild('settingsPanelChild')

    ;(this as any).addClass('vjs-settings')

    // Event handlers
    this.addSettingsItemHandler = this.onAddSettingsItem.bind(this)
    this.disposeSettingsItemHandler = this.onDisposeSettingsItem.bind(this)
    this.documentClickHandler = this.onDocumentClick.bind(this)
    this.userInactiveHandler = this.onUserInactive.bind(this)

    this.buildMenu()
    this.bindEvents()

    // Prepare the dialog
    ;(this as any).player().one('play', () => this.hideDialog())
  }

  onDocumentClick (event: MouseEvent) {
    const element = event.target as HTMLElement

    if (element?.classList?.contains('vjs-settings') || element?.parentElement?.classList?.contains('vjs-settings')) {
      return
    }

    if (!(this.dialog as any).hasClass('vjs-hidden')) {
      this.hideDialog()
    }
  }

  onDisposeSettingsItem (_event: any, name: string) {
    if (name === undefined) {
      const children = (this.menu as any).children()

      while (children.length > 0) {
        children[0].dispose()
        ;(this.menu as any).removeChild(children[0])
      }

      ;(this as any).addClass('vjs-hidden')
    } else {
      const item = (this.menu as any).getChild(name)

      if (item) {
        item.dispose()
        ;(this.menu as any).removeChild(item)
      }
    }

    this.hideDialog()

    if (this.settingsButtonOptions.entries.length === 0) {
      ;(this as any).addClass('vjs-hidden')
    }
  }

  dispose () {
    document.removeEventListener('click', this.documentClickHandler)

    if (this.isInIframe()) {
      window.removeEventListener('blur', this.documentClickHandler)
    }

    super.dispose()
  }

  onAddSettingsItem (_event: any, data: any) {
    const [ entry, options ] = data

    this.addMenuItem(entry, options)
    ;(this as any).removeClass('vjs-hidden')
  }

  onUserInactive () {
    if (!(this.dialog as any).hasClass('vjs-hidden')) {
      this.hideDialog()
    }
  }

  bindEvents () {
    document.addEventListener('click', this.documentClickHandler)

    if (this.isInIframe()) {
      window.addEventListener('blur', this.documentClickHandler)
    }

    ;(this as any).player().on('addsettingsitem', this.addSettingsItemHandler)
    ;(this as any).player().on('disposesettingsitem', this.disposeSettingsItemHandler)
    ;(this as any).player().on('userinactive', this.userInactiveHandler)
  }

  buildCSSClass () {
    return `vjs-icon-settings ${super.buildCSSClass()}`
  }

  handleClick () {
    if ((this.dialog as any).hasClass('vjs-hidden')) {
      this.showDialog()
    } else {
      this.hideDialog()
    }
  }

  showDialog () {
    ;(this as any).player().peertube().onMenuOpened()

    ;((this.menu as any).el() as HTMLElement).style.opacity = '1'

    ;(this.dialog as any).show()
    ;(this as any).el().setAttribute('aria-expanded', 'true')

    this.setDialogSize(this.getComponentSize(this.menu))

    ;(this.menu as any).focus()
  }

  hideDialog () {
    ;(this as any).player().peertube().onMenuClosed()

    ;(this.dialog as any).hide()
    ;(this as any).el().setAttribute('aria-expanded', 'false')

    this.setDialogSize(this.getComponentSize(this.menu))
    ;((this.menu as any).el() as HTMLElement).style.opacity = '1'
    this.resetChildren()
  }

  getComponentSize (element: videojs.Component | HTMLElement) {
    let width: number = null
    let height: number = null

    // Could be component or just DOM element
    if (element instanceof Component) {
      const el = (element as any).el() as HTMLElement

      width = el.offsetWidth
      height = el.offsetHeight
    } else {
      width = element.offsetWidth
      height = element.offsetHeight
    }

    return [ width, height ]
  }

  setDialogSize ([ width, height ]: number[]) {
    if (typeof height !== 'number') {
      return
    }

    const offset = this.settingsButtonOptions.setup.maxHeightOffset
    const maxHeight = ((this as any).player().el() as HTMLElement).offsetHeight - offset

    const panelEl = (this.panel as any).el() as HTMLElement

    if (height > maxHeight) {
      height = maxHeight
      width += 15
      panelEl.style.maxHeight = `${height}px`
    } else if (panelEl.style.maxHeight !== '') {
      panelEl.style.maxHeight = ''
    }

    this.dialogEl.style.width = `${width}px`
    this.dialogEl.style.height = `${height}px`
  }

  buildMenu () {
    this.menu = new (MenuFocusFixed as any)((this as any).player())
    ;(this.menu as any).on('escaped-key', () => {
      this.hideDialog()
      ;(this as any).focus()
    })

    ;(this.menu as any).addClass('vjs-main-menu')
    const entries = this.settingsButtonOptions.entries

    if (entries.length === 0) {
      ;(this as any).addClass('vjs-hidden')
      ;(this.panelChild as any).addChild(this.menu)
      return
    }

    for (const entry of entries) {
      this.addMenuItem(entry, this.settingsButtonOptions)
    }

    ;(this.panelChild as any).addChild(this.menu)
  }

  addMenuItem (entry: any, options: any) {
    const openSubMenu = function (this: any) {
      if (videojs.dom.hasClass(this.el_, 'open')) {
        videojs.dom.removeClass(this.el_, 'open')
      } else {
        videojs.dom.addClass(this.el_, 'open')
      }
    }

    options.name = toTitleCase(entry)

    const newOptions = Object.assign({}, options, { entry, menuButton: this })
    const settingsMenuItem = new SettingsMenuItem((this as any).player(), newOptions)

    ;(this.menu as any).addChild(settingsMenuItem)

    // Hide children to avoid sub menus stacking on top of each other
    // or having multiple menus open
    ;(settingsMenuItem as any).on('click', videojs.bind(this, this.hideChildren))

    // Whether to add or remove selected class on the settings sub menu element
    ;(settingsMenuItem as any).on('click', openSubMenu)
  }

  resetChildren () {
    for (const menuChild of (this.menu as any).children() as SettingsMenuItem[]) {
      ;(menuChild as any).reset()
    }
  }

  /**
   * Hide all the sub menus
   */
  hideChildren () {
    for (const menuChild of (this.menu as any).children() as SettingsMenuItem[]) {
      ;(menuChild as any).hideSubMenu()
    }
  }

  isInIframe () {
    return window.self !== window.top
  }


}

Component.registerComponent('SettingsButton', SettingsButton)

export { SettingsButton }
