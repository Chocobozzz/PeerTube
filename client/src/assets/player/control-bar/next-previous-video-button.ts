import videojs from 'video.js'
import { NextPreviousVideoButtonOptions } from '../peertube-videojs-typings'

const Button = videojs.getComponent('Button')

class NextPreviousVideoButton extends Button {
  private readonly nextPreviousVideoButtonOptions: NextPreviousVideoButtonOptions

  constructor (player: videojs.Player, options?: NextPreviousVideoButtonOptions) {
    super(player, options as any)

    this.nextPreviousVideoButtonOptions = options

    this.update()
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
    this.nextPreviousVideoButtonOptions.handler()
  }

  update () {
    const disabled = this.nextPreviousVideoButtonOptions.isDisabled()

    if (disabled) this.addClass('vjs-disabled')
    else this.removeClass('vjs-disabled')
  }
}

videojs.registerComponent('NextVideoButton', NextPreviousVideoButton)
videojs.registerComponent('PreviousVideoButton', NextPreviousVideoButton)
