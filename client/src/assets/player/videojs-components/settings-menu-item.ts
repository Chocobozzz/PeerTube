// Thanks to Yanko Shterev: https://github.com/yshterev/videojs-settings-menu
import { toTitleCase } from '../utils'
import videojs from 'video.js'
import { SettingsButton } from './settings-menu-button'
import { SettingsDialog } from './settings-dialog'
import { SettingsPanel } from './settings-panel'
import { SettingsPanelChild } from './settings-panel-child'

const MenuItem = videojs.getComponent('MenuItem')
const component = videojs.getComponent('Component')

export interface SettingsMenuItemOptions extends videojs.MenuItemOptions {
  entry: string
  menuButton: SettingsButton
}

class SettingsMenuItem extends MenuItem {
  settingsButton: SettingsButton
  dialog: SettingsDialog
  mainMenu: videojs.Menu
  panel: SettingsPanel
  panelChild: SettingsPanelChild
  panelChildEl: HTMLElement
  size: number[]
  menuToLoad: string
  subMenu: SettingsButton

  submenuClickHandler: typeof SettingsMenuItem.prototype.onSubmenuClick
  transitionEndHandler: typeof SettingsMenuItem.prototype.onTransitionEnd

  settingsSubMenuTitleEl_: HTMLElement
  settingsSubMenuValueEl_: HTMLElement
  settingsSubMenuEl_: HTMLElement

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

    this.subMenu = new SubMenuComponent(this.player(), newOptions) as any // FIXME: typings
    const subMenuClass = this.subMenu.buildCSSClass().split(' ')[ 0 ]
    this.settingsSubMenuEl_.className += ' ' + subMenuClass

    this.eventHandlers()

    player.ready(() => {
      // Voodoo magic for IOS
      setTimeout(() => {
        // Player was destroyed
        if (!this.player_) return

        this.build()

        // Update on rate change
        player.on('ratechange', this.submenuClickHandler)

        if (subMenuName === 'CaptionsButton') {
          // Hack to regenerate captions on HTTP fallback
          player.on('captionsChanged', () => {
            setTimeout(() => {
              this.settingsSubMenuEl_.innerHTML = ''
              this.settingsSubMenuEl_.appendChild(this.subMenu.menu.el())
              this.update()
              this.bindClickEvents()
            }, 0)
          })
        }

        this.reset()
      }, 0)
    })
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
      target = event.currentTarget
    }

    if (target && target.classList.contains('vjs-back-button')) {
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
   * @return {Element}
   * @method createEl
   */
  createEl () {
    const el = videojs.dom.createEl('li', {
      className: 'vjs-menu-item'
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

    button.addClass('vjs-back-button');
    (button.el() as HTMLElement).innerHTML = this.player().localize(this.subMenu.controlText())
  }

  /**
   * Add/remove prefixed event listener for CSS Transition
   *
   * @method PrefixedEvent
   */
  PrefixedEvent (element: any, type: any, callback: any, action = 'addEvent') {
    const prefix = [ 'webkit', 'moz', 'MS', 'o', '' ]

    for (let p = 0; p < prefix.length; p++) {
      if (!prefix[ p ]) {
        type = type.toLowerCase()
      }

      if (action === 'addEvent') {
        element.addEventListener(prefix[ p ] + type, callback, false)
      } else if (action === 'removeEvent') {
        element.removeEventListener(prefix[ p ] + type, callback, false)
      }
    }
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
    const mainMenuAny = this.mainMenu as any
    this.settingsButton.setDialogSize([ mainMenuAny.width, mainMenuAny.height ])

    // animation not triggered without timeout (some async stuff ?!?)
    setTimeout(() => {
      // animate margin and opacity before hiding the submenu
      // this triggers CSS Transition event
      this.setMargin()
      mainMenuEl.style.opacity = '1'
    }, 0)
  }

  build () {
    this.subMenu.on('updateLabel', () => {
      this.update()
    })
    this.subMenu.on('menuChanged', () => {
      this.bindClickEvents()
      this.setSize()
      this.update()
    })

    this.settingsSubMenuTitleEl_.innerHTML = this.player().localize(this.subMenu.controlText())
    this.settingsSubMenuEl_.appendChild(this.subMenu.menu.el())
    this.panelChildEl.appendChild(this.settingsSubMenuEl_)
    this.update()

    this.createBackButton()
    this.setSize()
    this.bindClickEvents()

    // prefixed event listeners for CSS TransitionEnd
    this.PrefixedEvent(
      this.settingsSubMenuEl_,
      'TransitionEnd',
      this.transitionEndHandler,
      'addEvent'
    )
  }

  update (event?: any) {
    let target: HTMLElement = null
    const subMenu = this.subMenu.name()

    if (event && event.type === 'tap') {
      target = event.target
    } else if (event) {
      target = event.currentTarget
    }

    // Playback rate menu button doesn't get a vjs-selected class
    // or sets options_['selected'] on the selected playback rate.
    // Thus we get the submenu value based on the labelEl of playbackRateMenuButton
    if (subMenu === 'PlaybackRateMenuButton') {
      const html = (this.subMenu as any).labelEl_.innerHTML
      setTimeout(() => this.settingsSubMenuValueEl_.innerHTML = html, 250)
    } else {
      // Loop trough the submenu items to find the selected child
      for (const subMenuItem of this.subMenu.menu.children_) {
        if (!(subMenuItem instanceof component)) {
          continue
        }

        if (subMenuItem.hasClass('vjs-selected')) {
          const subMenuItemUntyped = subMenuItem as any

          // Prefer to use the function
          if (typeof subMenuItemUntyped.getLabel === 'function') {
            this.settingsSubMenuValueEl_.innerHTML = subMenuItemUntyped.getLabel()
            break
          }

          this.settingsSubMenuValueEl_.innerHTML = subMenuItemUntyped.options_.label
        }
      }
    }

    if (target && !target.classList.contains('vjs-back-button')) {
      this.settingsButton.hideDialog()
    }
  }

  bindClickEvents () {
    for (const item of this.subMenu.menu.children()) {
      if (!(item instanceof component)) {
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

}

(SettingsMenuItem as any).prototype.contentElType = 'button'
videojs.registerComponent('SettingsMenuItem', SettingsMenuItem)

export { SettingsMenuItem }
