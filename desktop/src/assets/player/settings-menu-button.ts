// Author: Yanko Shterev
// Thanks https://github.com/yshterev/videojs-settings-menu

import * as videojs from 'video.js'
import { SettingsMenuItem } from './settings-menu-item'
import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import { toTitleCase } from './utils'

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')
const Menu: VideoJSComponentInterface = videojsUntyped.getComponent('Menu')
const Component: VideoJSComponentInterface = videojsUntyped.getComponent('Component')

class SettingsButton extends Button {
  constructor (player: videojs.Player, options) {
    super(player, options)

    this.playerComponent = player
    this.dialog = this.playerComponent.addChild('settingsDialog')
    this.dialogEl = this.dialog.el_
    this.menu = null
    this.panel = this.dialog.addChild('settingsPanel')
    this.panelChild = this.panel.addChild('settingsPanelChild')

    this.addClass('vjs-settings')
    this.el_.setAttribute('aria-label', 'Settings Button')

    // Event handlers
    this.addSettingsItemHandler = this.onAddSettingsItem.bind(this)
    this.disposeSettingsItemHandler = this.onDisposeSettingsItem.bind(this)
    this.playerClickHandler = this.onPlayerClick.bind(this)
    this.userInactiveHandler = this.onUserInactive.bind(this)

    this.buildMenu()
    this.bindEvents()

    // Prepare the dialog
    this.player().one('play', () => this.hideDialog())
  }

  onPlayerClick (event: MouseEvent) {
    const element = event.target as HTMLElement
    if (element.classList.contains('vjs-settings') || element.parentElement.classList.contains('vjs-settings')) {
      return
    }

    if (!this.dialog.hasClass('vjs-hidden')) {
      this.hideDialog()
    }
  }

  onDisposeSettingsItem (event, name: string) {
    if (name === undefined) {
      let children = this.menu.children()

      while (children.length > 0) {
        children[0].dispose()
        this.menu.removeChild(children[0])
      }

      this.addClass('vjs-hidden')
    } else {
      let item = this.menu.getChild(name)

      if (item) {
        item.dispose()
        this.menu.removeChild(item)
      }
    }

    this.hideDialog()

    if (this.options_.entries.length === 0) {
      this.addClass('vjs-hidden')
    }
  }

  onAddSettingsItem (event, data) {
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
    this.playerComponent.on('click', this.playerClickHandler)
    this.playerComponent.on('addsettingsitem', this.addSettingsItemHandler)
    this.playerComponent.on('disposesettingsitem', this.disposeSettingsItemHandler)
    this.playerComponent.on('userinactive', this.userInactiveHandler)
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
    this.menu.el_.style.opacity = '1'
    this.dialog.show()

    this.setDialogSize(this.getComponentSize(this.menu))
  }

  hideDialog () {
    this.dialog.hide()
    this.setDialogSize(this.getComponentSize(this.menu))
    this.menu.el_.style.opacity = '1'
    this.resetChildren()
  }

  getComponentSize (element) {
    let width: number = null
    let height: number = null

    // Could be component or just DOM element
    if (element instanceof Component) {
      width = element.el_.offsetWidth
      height = element.el_.offsetHeight

      // keep width/height as properties for direct use
      element.width = width
      element.height = height
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

    let offset = this.options_.setup.maxHeightOffset
    let maxHeight = this.playerComponent.el_.offsetHeight - offset

    if (height > maxHeight) {
      height = maxHeight
      width += 17
      this.panel.el_.style.maxHeight = `${height}px`
    } else if (this.panel.el_.style.maxHeight !== '') {
      this.panel.el_.style.maxHeight = ''
    }

    this.dialogEl.style.width = `${width}px`
    this.dialogEl.style.height = `${height}px`
  }

  buildMenu () {
    this.menu = new Menu(this.player())
    this.menu.addClass('vjs-main-menu')
    let entries = this.options_.entries

    if (entries.length === 0) {
      this.addClass('vjs-hidden')
      this.panelChild.addChild(this.menu)
      return
    }

    for (let entry of entries) {
      this.addMenuItem(entry, this.options_)
    }

    this.panelChild.addChild(this.menu)
  }

  addMenuItem (entry, options) {
    const openSubMenu = function () {
      if (videojsUntyped.dom.hasClass(this.el_, 'open')) {
        videojsUntyped.dom.removeClass(this.el_, 'open')
      } else {
        videojsUntyped.dom.addClass(this.el_, 'open')
      }
    }

    options.name = toTitleCase(entry)
    let settingsMenuItem = new SettingsMenuItem(this.player(), options, entry, this as any)

    this.menu.addChild(settingsMenuItem)

    // Hide children to avoid sub menus stacking on top of each other
    // or having multiple menus open
    settingsMenuItem.on('click', videojs.bind(this, this.hideChildren))

    // Whether to add or remove selected class on the settings sub menu element
    settingsMenuItem.on('click', openSubMenu)
  }

  resetChildren () {
    for (let menuChild of this.menu.children()) {
      menuChild.reset()
    }
  }

  /**
   * Hide all the sub menus
   */
  hideChildren () {
    for (let menuChild of this.menu.children()) {
      menuChild.hideSubMenu()
    }
  }

}

class SettingsPanel extends Component {
  constructor (player: videojs.Player, options) {
    super(player, options)
  }

  createEl () {
    return super.createEl('div', {
      className: 'vjs-settings-panel',
      innerHTML: '',
      tabIndex: -1
    })
  }
}

class SettingsPanelChild extends Component {
  constructor (player: videojs.Player, options) {
    super(player, options)
  }

  createEl () {
    return super.createEl('div', {
      className: 'vjs-settings-panel-child',
      innerHTML: '',
      tabIndex: -1
    })
  }
}

class SettingsDialog extends Component {
  constructor (player: videojs.Player, options) {
    super(player, options)
    this.hide()
  }

  /**
   * Create the component's DOM element
   *
   * @return {Element}
   * @method createEl
   */
  createEl () {
    const uniqueId = this.id_
    const dialogLabelId = 'TTsettingsDialogLabel-' + uniqueId
    const dialogDescriptionId = 'TTsettingsDialogDescription-' + uniqueId

    return super.createEl('div', {
      className: 'vjs-settings-dialog vjs-modal-overlay',
      innerHTML: '',
      tabIndex: -1
    }, {
      'role': 'dialog',
      'aria-labelledby': dialogLabelId,
      'aria-describedby': dialogDescriptionId
    })
  }

}

SettingsButton.prototype.controlText_ = 'Settings'

Component.registerComponent('SettingsButton', SettingsButton)
Component.registerComponent('SettingsDialog', SettingsDialog)
Component.registerComponent('SettingsPanel', SettingsPanel)
Component.registerComponent('SettingsPanelChild', SettingsPanelChild)

export { SettingsButton, SettingsDialog, SettingsPanel, SettingsPanelChild }
