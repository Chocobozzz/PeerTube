import videojs from 'video.js'
import { NextPreviousVideoButtonOptions } from '../../types'

const Button = videojs.getComponent('Button')

class NextPreviousVideoButton extends Button {
  declare options_: NextPreviousVideoButtonOptions & videojs.ComponentOptions

  constructor (player: videojs.Player, options?: NextPreviousVideoButtonOptions & videojs.ComponentOptions) {
    super(player, options)

    this.player().on('video-change', () => {
      this.updateDisabled()
      this.updateShowing()
    })

    this.updateDisabled()
    this.updateShowing()
  }

  createEl () {
    const type = (this.options_ as NextPreviousVideoButtonOptions).type

    const button = videojs.dom.createEl('button', {
      className: 'vjs-' + type + '-video'
    }) as HTMLButtonElement
    const nextIcon = videojs.dom.createEl('span', {
      className: 'icon icon-' + type
    })
    button.appendChild(nextIcon)

    if (type === 'next') {
      button.title = this.player_.localize('Next video')
    } else {
      button.title = this.player_.localize('Previous video')
    }

    return button
  }

  handleClick () {
    this.options_.handler()
  }

  updateDisabled () {
    const disabled = this.options_.isDisabled()

    if (disabled) this.addClass('vjs-disabled')
    else this.removeClass('vjs-disabled')
  }

  updateShowing () {
    if (this.options_.isDisplayed()) this.show()
    else this.hide()
  }
}

videojs.registerComponent('NextVideoButton', NextPreviousVideoButton)
videojs.registerComponent('PreviousVideoButton', NextPreviousVideoButton)
