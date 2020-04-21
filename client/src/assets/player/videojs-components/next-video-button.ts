import videojs from 'video.js'

const Button = videojs.getComponent('Button')

export interface NextVideoButtonOptions extends videojs.ComponentOptions {
  handler: Function
}

class NextVideoButton extends Button {
  private readonly nextVideoButtonOptions: NextVideoButtonOptions

  constructor (player: videojs.Player, options?: NextVideoButtonOptions) {
    super(player, options)

    this.nextVideoButtonOptions = options
  }

  createEl () {
    const button = videojs.dom.createEl('button', {
      className: 'vjs-next-video'
    }) as HTMLButtonElement
    const nextIcon = videojs.dom.createEl('span', {
      className: 'icon icon-next'
    })
    button.appendChild(nextIcon)

    button.title = this.player_.localize('Next video')

    return button
  }

  handleClick () {
    this.nextVideoButtonOptions.handler()
  }
}

videojs.registerComponent('NextVideoButton', NextVideoButton)
