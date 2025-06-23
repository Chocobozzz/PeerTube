import videojs from 'video.js'

const Component = videojs.getComponent('Component')

class SettingsDialog extends Component {
  private previouslyFocusedElement: HTMLElement | null = null
  private keydownHandler: (event: KeyboardEvent) => void

  constructor (player: videojs.Player) {
    super(player)

    this.keydownHandler = this.handleKeydown.bind(this)
    this.hide()
  }

  /**
   * Create the component's DOM element
   *
   */
  createEl () {
    const uniqueId = this.id()
    const dialogLabelId = 'TTsettingsDialogLabel-' + uniqueId
    const dialogDescriptionId = 'TTsettingsDialogDescription-' + uniqueId

    const el = super.createEl('div', {
      className: 'vjs-settings-dialog vjs-modal-overlay',
      tabIndex: -1
    }, {
      'role': 'dialog',
      'aria-labelledby': dialogLabelId,
      'aria-describedby': dialogDescriptionId,
      'aria-modal': 'true'
    })

    const labelEl = document.createElement('h2')
    labelEl.id = dialogLabelId
    labelEl.className = 'vjs-settings-dialog-label vjs-hidden'
    labelEl.textContent = this.player().localize('Settings')
    el.appendChild(labelEl)

    const descriptionEl = document.createElement('div')
    descriptionEl.id = dialogDescriptionId
    descriptionEl.className = 'vjs-settings-dialog-description vjs-hidden'
    descriptionEl.textContent = this.player().localize('Video player settings menu')
    el.appendChild(descriptionEl)

    return el
  }

  show () {
    this.player().addClass('vjs-settings-dialog-opened')

    super.show()

    this.previouslyFocusedElement = document.activeElement as HTMLElement

    document.addEventListener('keydown', this.keydownHandler)

    setTimeout(() => {
      (this.el() as HTMLElement).focus()
    }, 0)
  }

  hide () {
    this.player().removeClass('vjs-settings-dialog-opened')

    super.hide()

    document.removeEventListener('keydown', this.keydownHandler)

    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus()
      this.previouslyFocusedElement = null
    }
  }

  private handleKeydown (event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      this.hide()
      return
    }

    if (event.key === 'Tab') {
      this.trapFocus(event)
    }
  }

  private trapFocus (event: KeyboardEvent) {
    const focusableElements = this.el().querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }
}

Component.registerComponent('SettingsDialog', SettingsDialog)

export { SettingsDialog }
