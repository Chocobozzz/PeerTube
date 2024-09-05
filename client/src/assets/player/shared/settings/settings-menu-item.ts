import debug from 'debug'
import videojs from 'video.js'
import { toTitleCase } from '../common'
import { SettingsDialog } from './settings-dialog'
import { SettingsButton } from './settings-menu-button'
import { SettingsPanel } from './settings-panel'
import { SettingsPanelChild } from './settings-panel-child'

const debugLogger = debug('peertube:player:settings')

const MenuItem = videojs.getComponent('MenuItem')
const Component = videojs.getComponent('Component')

interface MenuItemExtended extends videojs.MenuItem {
  isSelected_: boolean

  getLabel?: () => string
}

export interface SettingsMenuItemOptions extends videojs.MenuItemOptions {
  entry: string
  menuButton: SettingsButton
}

class SettingsMenuItem extends MenuItem {
  declare settingsButton: SettingsButton
  declare dialog: SettingsDialog
  declare mainMenu: videojs.Menu
  declare panel: SettingsPanel
  declare panelChild: SettingsPanelChild
  declare panelChildEl: HTMLElement
  declare size: number[]
  declare menuToLoad: string
  declare subMenu: SettingsButton

  declare submenuClickHandler: typeof SettingsMenuItem.prototype.onSubmenuClick
  declare transitionEndHandler: typeof SettingsMenuItem.prototype.onTransitionEnd

  declare settingsSubMenuTitleEl_: HTMLElement
  declare settingsSubMenuValueEl_: HTMLElement
  declare settingsSubMenuEl_: HTMLElement

  constructor (player: videojs.Player, options?: SettingsMenuItemOptions) {
    super(player, options)

    this.settingsButton = options.menuButton
    this.dialog = this.settingsButton.dialog
    this.mainMenu = this.settingsButton.menu
    this.panel = this.dialog.getChild('settingsPanel')
    this.panelChild = this.panel.getChild('settingsPanelChild')
    this.panelChildEl = this.panelChild.el() as HTMLElement

    this.size = null

    // keep state of what menu type is loading next
    this.menuToLoad = 'mainmenu'

    const subMenuName = toTitleCase(options.entry)
    const SubMenuComponent = videojs.getComponent(subMenuName)

    if (!SubMenuComponent) {
      throw new Error(`Component ${subMenuName} does not exist`)
    }

    const newOptions = Object.assign({}, options, { entry: options.menuButton, menuButton: this })

    this.subMenu = new SubMenuComponent(this.player(), newOptions) as SettingsButton
    const subMenuClass = this.subMenu.buildCSSClass().split(' ')[0]
    this.settingsSubMenuEl_.className += ' ' + subMenuClass

    this.eventHandlers()

    player.ready(() => {
      // Voodoo magic for IOS
      setTimeout(() => {
        // Player was destroyed
        if (!this.player_) return

        this.build()

        // Update on rate change
        if (subMenuName === 'PlaybackRateMenuButton') {
          player.on('ratechange', this.submenuClickHandler)
        }

        if (subMenuName === 'CaptionsButton') {
          player.on('captions-changed', () => {
            setTimeout(() => this.rebuildAfterMenuChange())
          })

          // Needed because 'captions-changed' event doesn't contain the selected caption yet
          player.on('texttrackchange', this.submenuClickHandler)
        }

        if (subMenuName === 'ResolutionMenuButton') {
          this.subMenu.on('resolution-menu-changed', () => {
            this.rebuildAfterMenuChange()
          })
        }

        this.reset()
      }, 0)
    })
  }

  dispose () {
    this.settingsSubMenuEl_.removeEventListener('transitionend', this.transitionEndHandler)

    super.dispose()
  }

  eventHandlers () {
    this.submenuClickHandler = this.onSubmenuClick.bind(this)
    this.transitionEndHandler = this.onTransitionEnd.bind(this)
  }

  onSubmenuClick (event: any) {
    let target = null

    if (event.type === 'tap') {
      target = event.target
    } else {
      target = event.currentTarget || event.target
    }

    if (target?.classList.contains('vjs-back-button')) {
      this.loadMainMenu()
      return
    }

    // To update the sub menu value on click, setTimeout is needed because
    // updating the value is not instant
    setTimeout(() => this.update(event), 0)

    // Seems like videojs adds a vjs-hidden class on the caption menu after a click
    // We don't need it
    this.subMenu.menu.removeClass('vjs-hidden')
  }

  /**
   * Create the component's DOM element
   *
   */
  createEl () {
    const el = videojs.dom.createEl('li', {
      className: 'vjs-menu-item',
      tabIndex: 0
    })

    this.settingsSubMenuTitleEl_ = videojs.dom.createEl('div', {
      className: 'vjs-settings-sub-menu-title'
    }) as HTMLElement

    el.appendChild(this.settingsSubMenuTitleEl_)

    this.settingsSubMenuValueEl_ = videojs.dom.createEl('div', {
      className: 'vjs-settings-sub-menu-value'
    }) as HTMLElement

    el.appendChild(this.settingsSubMenuValueEl_)

    this.settingsSubMenuEl_ = videojs.dom.createEl('div', {
      className: 'vjs-settings-sub-menu'
    }) as HTMLElement

    return el as HTMLLIElement
  }

  /**
   * Handle click on menu item
   *
   * @method handleClick
   */
  handleClick (event: videojs.EventTarget.Event) {
    this.menuToLoad = 'submenu'
    // Remove open class to ensure only the open submenu gets this class
    videojs.dom.removeClass(this.el(), 'open')

    super.handleClick(event);

    (this.mainMenu.el() as HTMLElement).style.opacity = '0'
    // Whether to add or remove vjs-hidden class on the settingsSubMenuEl element
    if (videojs.dom.hasClass(this.settingsSubMenuEl_, 'vjs-hidden')) {
      videojs.dom.removeClass(this.settingsSubMenuEl_, 'vjs-hidden')

      // animation not played without timeout
      setTimeout(() => {
        this.settingsSubMenuEl_.style.opacity = '1'
        this.settingsSubMenuEl_.style.marginRight = '0px'
      }, 0)

      this.settingsButton.setDialogSize(this.size)

      this.subMenu.menu.focus()
    } else {
      videojs.dom.addClass(this.settingsSubMenuEl_, 'vjs-hidden')
    }
  }

  /**
   * Create back button
   *
   * @method createBackButton
   */
  createBackButton () {
    const button = this.subMenu.menu.addChild('MenuItem', {}, 0)

    button.setAttribute('aria-label', this.player().localize('Go back'))
    button.addClass('vjs-back-button');

    (button.el() as HTMLElement).innerHTML = this.player().localize(this.subMenu.controlText())
  }

  onTransitionEnd (event: any) {
    if (event.propertyName !== 'margin-right') {
      return
    }

    if (this.menuToLoad === 'mainmenu') {
      // hide submenu
      videojs.dom.addClass(this.settingsSubMenuEl_, 'vjs-hidden')

      // reset opacity to 0
      this.settingsSubMenuEl_.style.opacity = '0'
    }
  }

  reset () {
    videojs.dom.addClass(this.settingsSubMenuEl_, 'vjs-hidden')
    this.settingsSubMenuEl_.style.opacity = '0'
    this.setMargin()
  }

  loadMainMenu () {
    const mainMenuEl = this.mainMenu.el() as HTMLElement
    this.menuToLoad = 'mainmenu'
    this.mainMenu.show()
    mainMenuEl.style.opacity = '0'

    // back button will always take you to main menu, so set dialog sizes
    const mainMenuAny = this.mainMenu
    this.settingsButton.setDialogSize([ mainMenuAny.width() as number, mainMenuAny.height() as number ])

    // animation not triggered without timeout (some async stuff ?!?)
    setTimeout(() => {
      // animate margin and opacity before hiding the submenu
      // this triggers CSS Transition event
      this.setMargin()
      mainMenuEl.style.opacity = '1'

      this.mainMenu.focus()
    }, 0)
  }

  build () {
    this.subMenu.on('label-updated', () => {
      this.update()
    })

    this.settingsSubMenuTitleEl_.innerHTML = this.player().localize(this.subMenu.controlText())
    this.settingsSubMenuEl_.appendChild(this.subMenu.menu.el())
    this.panelChildEl.appendChild(this.settingsSubMenuEl_)
    this.update()

    this.createBackButton()
    this.setSize()
    this.bindClickEvents()

    this.settingsSubMenuEl_.addEventListener('transitionend', this.transitionEndHandler, false)
  }

  update (event?: any) {
    // Playback rate menu button doesn't get a vjs-selected class
    // or sets options_['selected'] on the selected playback rate.
    // Thus we get the submenu value based on the labelEl of playbackRateMenuButton
    if (this.subMenu.name() === 'PlaybackRateMenuButton') {
      this.settingsSubMenuValueEl_.innerHTML = (this.subMenu as any).labelEl_.textContent
    } else {
      // Loop through the submenu items to find the selected child
      for (const subMenuItem of this.subMenu.menu.children_) {
        if (!(subMenuItem instanceof MenuItem)) {
          continue
        }

        const subMenuItemExtended = subMenuItem as MenuItemExtended
        if (subMenuItemExtended.isSelected_) {

          // Prefer to use the function
          if (typeof subMenuItemExtended.getLabel === 'function') {
            this.settingsSubMenuValueEl_.innerHTML = subMenuItemExtended.getLabel()
            break
          }

          this.settingsSubMenuValueEl_.innerHTML = this.player().localize(subMenuItemExtended.options_.label)
        }
      }
    }

    let target: HTMLElement = null
    if (event && event.type === 'tap') {
      target = event.target
    } else if (event) {
      target = event.currentTarget
    }

    if (target && !target.classList.contains('vjs-back-button')) {
      this.settingsButton.hideDialog()
    }
  }

  bindClickEvents () {
    for (const item of this.subMenu.menu.children()) {
      if (!(item instanceof Component)) {
        continue
      }
      item.on([ 'tap', 'click' ], this.submenuClickHandler)
    }
  }

  // save size of submenus on first init
  // if number of submenu items change dynamically more logic will be needed
  setSize () {
    this.dialog.removeClass('vjs-hidden')
    videojs.dom.removeClass(this.settingsSubMenuEl_, 'vjs-hidden')
    this.size = this.settingsButton.getComponentSize(this.settingsSubMenuEl_)
    this.setMargin()
    this.dialog.addClass('vjs-hidden')
    videojs.dom.addClass(this.settingsSubMenuEl_, 'vjs-hidden')
  }

  setMargin () {
    if (!this.size) return

    const [ width ] = this.size

    this.settingsSubMenuEl_.style.marginRight = `-${width}px`
  }

  /**
   * Hide the sub menu
   */
  hideSubMenu () {
    // after removing settings item this.el_ === null
    if (!this.el()) {
      return
    }

    if (videojs.dom.hasClass(this.el(), 'open')) {
      videojs.dom.addClass(this.settingsSubMenuEl_, 'vjs-hidden')
      videojs.dom.removeClass(this.el(), 'open')
    }
  }

  private rebuildAfterMenuChange () {
    debugLogger('Rebuilding menu ' + this.subMenu.name() + ' after change')

    this.settingsSubMenuEl_.innerHTML = ''
    this.settingsSubMenuEl_.appendChild(this.subMenu.menu.el())
    this.update()
    this.createBackButton()
    this.setSize()
    this.bindClickEvents()
  }

}

(SettingsMenuItem as any).prototype.contentElType = 'button'
videojs.registerComponent('SettingsMenuItem', SettingsMenuItem)

export { SettingsMenuItem }
