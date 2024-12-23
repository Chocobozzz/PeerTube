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

    this.controlText('Settings')

    this.dialog = this.player().addChild('settingsDialog')
    this.dialogEl = this.dialog.el() as HTMLElement
    this.menu = null
    this.panel = this.dialog.addChild('settingsPanel')
    this.panelChild = this.panel.addChild('settingsPanelChild')

    this.addClass('vjs-settings')

    // Event handlers
    this.addSettingsItemHandler = this.onAddSettingsItem.bind(this)
    this.disposeSettingsItemHandler = this.onDisposeSettingsItem.bind(this)
    this.documentClickHandler = this.onDocumentClick.bind(this)
    this.userInactiveHandler = this.onUserInactive.bind(this)

    this.buildMenu()
    this.bindEvents()

    // Prepare the dialog
    this.player().one('play', () => this.hideDialog())
  }

  onDocumentClick (event: MouseEvent) {
    const element = event.target as HTMLElement

    if (element?.classList?.contains('vjs-settings') || element?.parentElement?.classList?.contains('vjs-settings')) {
      return
    }

    if (!this.dialog.hasClass('vjs-hidden')) {
      this.hideDialog()
    }
  }

  onDisposeSettingsItem (_event: any, name: string) {
    if (name === undefined) {
      const children = this.menu.children()

      while (children.length > 0) {
        children[0].dispose()
        this.menu.removeChild(children[0])
      }

      this.addClass('vjs-hidden')
    } else {
      const item = this.menu.getChild(name)

      if (item) {
        item.dispose()
        this.menu.removeChild(item)
      }
    }

    this.hideDialog()

    if (this.settingsButtonOptions.entries.length === 0) {
      this.addClass('vjs-hidden')
    }
  }

  dispose () {
    document.removeEventListener('click', this.documentClickHandler)

    if (this.isInIframe()) {
      window.removeEventListener('blur', this.documentClickHandler)
    }

    super.dispose()
  }

  onAddSettingsItem (event: any, data: any) {
    const [ entry, options ] = data

    this.addMenuItem(entry, options)
    this.removeClass('vjs-hidden')
  }

  onUserInactive () {
    if (!this.dialog.hasClass('vjs-hidden')) {
      this.hideDialog()
    }
  }

  bindEvents () {
    document.addEventListener('click', this.documentClickHandler)

    if (this.isInIframe()) {
      window.addEventListener('blur', this.documentClickHandler)
    }

    this.player().on('addsettingsitem', this.addSettingsItemHandler)
    this.player().on('disposesettingsitem', this.disposeSettingsItemHandler)
    this.player().on('userinactive', this.userInactiveHandler)
  }

  buildCSSClass () {
    return `vjs-icon-settings ${super.buildCSSClass()}`
  }

  handleClick () {
    if (this.dialog.hasClass('vjs-hidden')) {
      this.showDialog()
    } else {
      this.hideDialog()
    }
  }

  showDialog () {
    this.player().peertube().onMenuOpened();

    (this.menu.el() as HTMLElement).style.opacity = '1'

    this.dialog.show()
    this.el().setAttribute('aria-expanded', 'true')

    this.setDialogSize(this.getComponentSize(this.menu))

    this.menu.focus()
  }

  hideDialog () {
    this.player_.peertube().onMenuClosed()

    this.dialog.hide()
    this.el().setAttribute('aria-expanded', 'false')

    this.setDialogSize(this.getComponentSize(this.menu));
    (this.menu.el() as HTMLElement).style.opacity = '1'
    this.resetChildren()
  }

  getComponentSize (element: videojs.Component | HTMLElement) {
    let width: number = null
    let height: number = null

    // Could be component or just DOM element
    if (element instanceof Component) {
      const el = element.el() as HTMLElement

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
    const maxHeight = (this.player().el() as HTMLElement).offsetHeight - offset

    const panelEl = this.panel.el() as HTMLElement

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
    this.menu = new MenuFocusFixed(this.player())
    this.menu.on('escaped-key', () => {
      this.hideDialog()
      this.focus()
    })

    this.menu.addClass('vjs-main-menu')
    const entries = this.settingsButtonOptions.entries

    if (entries.length === 0) {
      this.addClass('vjs-hidden')
      this.panelChild.addChild(this.menu)
      return
    }

    for (const entry of entries) {
      this.addMenuItem(entry, this.settingsButtonOptions)
    }

    this.panelChild.addChild(this.menu)
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
    const settingsMenuItem = new SettingsMenuItem(this.player(), newOptions)

    this.menu.addChild(settingsMenuItem)

    // Hide children to avoid sub menus stacking on top of each other
    // or having multiple menus open
    // eslint-disable-next-line @typescript-eslint/unbound-method
    settingsMenuItem.on('click', videojs.bind(this, this.hideChildren))

    // Whether to add or remove selected class on the settings sub menu element
    settingsMenuItem.on('click', openSubMenu)
  }

  resetChildren () {
    for (const menuChild of this.menu.children() as SettingsMenuItem[]) {
      menuChild.reset()
    }
  }

  /**
   * Hide all the sub menus
   */
  hideChildren () {
    for (const menuChild of this.menu.children() as SettingsMenuItem[]) {
      menuChild.hideSubMenu()
    }
  }

  isInIframe () {
    return window.self !== window.top
  }

}

Component.registerComponent('SettingsButton', SettingsButton)

export { SettingsButton }
