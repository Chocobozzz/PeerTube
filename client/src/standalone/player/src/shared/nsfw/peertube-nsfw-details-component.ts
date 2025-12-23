import { NSFWFlag } from '@peertube/peertube-models'
import videojs from 'video.js'
import { VideojsComponent, VideojsComponentOptions, VideojsPlayer } from '../../types'
import { type PeerTubeNSFWPluginOptions } from './peertube-nsfw-plugin'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

class PeerTubeNSFWDetailsComponent extends Component {
  declare options_: VideojsComponentOptions & PeerTubeNSFWPluginOptions

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (player: VideojsPlayer, options: VideojsComponentOptions & PeerTubeNSFWPluginOptions) {
    super(player, options)
  }

  createEl () {
    // Overlay
    const el = super.createEl('div', { className: 'nsfw-details-container' })

    const nsfwDetails = super.createEl('div', { className: 'nsfw-details' })
    el.appendChild(nsfwDetails)

    const closeButton = super.createEl('button', {
      className: 'nsfw-details-close',
      title: this.player().localize('Close details'),
      type: 'button'
    }) as HTMLButtonElement

    closeButton.addEventListener('click', () => {
      this.trigger('hideDetails')
    })

    nsfwDetails.appendChild(closeButton)

    const content = super.createEl('div', { className: 'nsfw-details-content' })
    nsfwDetails.appendChild(content)

    if (this.options_.flags) {
      const flags = super.createEl('div', { className: 'nsfw-details-flags' })

      const label = super.createEl('strong', { textContent: this.player().localize('This video contains sensitive content, including:') })
      flags.appendChild(label)

      flags.appendChild(super.createEl('div', { textContent: this.buildFlagStrings().join(' - ') }))

      content.appendChild(flags)
    }

    if (this.options_.summary) {
      const summary = super.createEl('div', { className: 'nsfw-details-summary' })

      const label = super.createEl('strong', { textContent: this.player().localize('Uploader note:') })
      summary.appendChild(label)

      summary.appendChild(super.createEl('div', { textContent: this.options_.summary }))

      content.appendChild(summary)
    }

    return el
  }

  private buildFlagStrings () {
    const flags = this.options_.flags
    const flagStrings: string[] = []

    if ((flags & NSFWFlag.VIOLENT) === NSFWFlag.VIOLENT) {
      flagStrings.push(this.player().localize(`Potentially violent content`))
    }

    if ((flags & NSFWFlag.EXPLICIT_SEX) === NSFWFlag.EXPLICIT_SEX) {
      flagStrings.push(this.player().localize(`Potentially sexually explicit content`))
    }

    return flagStrings
  }
}

videojs.registerComponent('PeerTubeNSFWDetailsComponent', PeerTubeNSFWDetailsComponent)

export {
  PeerTubeNSFWDetailsComponent
}
