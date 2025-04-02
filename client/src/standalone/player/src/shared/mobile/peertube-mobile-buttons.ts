import videojs from 'video.js'

const Component = videojs.getComponent('Component')
class PeerTubeMobileButtons extends Component {
  declare private mainButton: HTMLDivElement

  declare private rewind: Element
  declare private forward: Element
  declare private rewindText: Element
  declare private forwardText: Element

  declare private touchStartHandler: (e: TouchEvent) => void

  createEl () {
    const container = super.createEl('div', { className: 'vjs-mobile-buttons-overlay' }) as HTMLDivElement
    this.mainButton = super.createEl('div', { className: 'main-button' }) as HTMLDivElement

    this.touchStartHandler = e => {
      e.stopPropagation()

      if (this.player_.paused() || this.player_.ended()) {
        this.player_.play()
        return
      }

      this.player_.pause()
    }

    this.mainButton.addEventListener('touchstart', this.touchStartHandler, { passive: true })

    this.rewind = super.createEl('div', { className: 'rewind-button vjs-hidden' })
    this.forward = super.createEl('div', { className: 'forward-button vjs-hidden' })

    for (let i = 0; i < 3; i++) {
      this.rewind.appendChild(super.createEl('span', { className: 'icon' }))
      this.forward.appendChild(super.createEl('span', { className: 'icon' }))
    }

    this.rewindText = this.rewind.appendChild(super.createEl('div', { className: 'text' }))
    this.forwardText = this.forward.appendChild(super.createEl('div', { className: 'text' }))

    container.appendChild(this.rewind)
    container.appendChild(this.mainButton)
    container.appendChild(this.forward)

    return container
  }

  dispose () {
    if (this.touchStartHandler) this.mainButton.removeEventListener('touchstart', this.touchStartHandler)

    super.dispose()
  }

  displayFastSeek (amount: number) {
    if (amount === 0) {
      this.hideRewind()
      this.hideForward()
      return
    }

    if (amount > 0) {
      this.hideRewind()
      this.displayForward(amount)
      return
    }

    if (amount < 0) {
      this.hideForward()
      this.displayRewind(amount)
      return
    }
  }

  private hideRewind () {
    this.rewind.classList.add('vjs-hidden')
    this.rewindText.textContent = ''
  }

  private displayRewind (amount: number) {
    this.rewind.classList.remove('vjs-hidden')
    this.rewindText.textContent = this.player().localize('{1} seconds', [ amount + '' ])
  }

  private hideForward () {
    this.forward.classList.add('vjs-hidden')
    this.forwardText.textContent = ''
  }

  private displayForward (amount: number) {
    this.forward.classList.remove('vjs-hidden')
    this.forwardText.textContent = this.player().localize('{1} seconds', [ amount + '' ])
  }
}

videojs.registerComponent('PeerTubeMobileButtons', PeerTubeMobileButtons)

export {
  PeerTubeMobileButtons
}
