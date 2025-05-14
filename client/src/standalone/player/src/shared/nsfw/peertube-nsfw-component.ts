import { NSFWFlag } from '@peertube/peertube-models'
import videojs from 'video.js'
import { type PeerTubeNSFWPluginOptions } from './peertube-nsfw-plugin'

const Component = videojs.getComponent('Component')

class PeerTubeNSFWComponent extends Component {
  declare options_: videojs.ComponentOptions & PeerTubeNSFWPluginOptions

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (player: videojs.Player, options: videojs.ComponentOptions & PeerTubeNSFWPluginOptions) {
    super(player, options)
  }

  createEl () {
    const el = super.createEl('div', { className: 'nsfw-container' })

    const title = super.createEl('div', { className: 'nsfw-title' })
    title.textContent = this.player().localize('Sensitive content')

    const content = super.createEl('div', { className: 'nsfw-content' })
    content.textContent = this.player().localize('This video contains sensitive content.')

    el.appendChild(title)
    el.appendChild(content)

    if (this.options_.flags || this.options_.summary) {
      const moreButton = super.createEl(
        'button',
        { textContent: this.player().localize('Learn more') },
        { type: 'button' }
      ) as HTMLButtonElement

      el.appendChild(moreButton)

      moreButton.addEventListener('click', () => {
        this.appendMoreContent()

        moreButton.style.display = 'none'
      })
    }

    return el
  }

  private appendMoreContent () {
    const moreContentEl = super.createEl('div', { className: 'nsfw-more-content' })

    if (this.options_.flags) {
      const moreContentFlags = super.createEl('div', { className: 'nsfw-more-flags' })
      moreContentFlags.appendChild(super.createEl('strong', { textContent: this.player().localize('Content warning') }))
      moreContentFlags.appendChild(super.createEl('div', { textContent: this.buildFlagStrings().join(' - ') }))

      moreContentEl.appendChild(moreContentFlags)
    }

    if (this.options_.summary) {
      const moreContentSummary = super.createEl('div', { className: 'nsfw-more-summary' })
      moreContentSummary.appendChild(super.createEl('strong', { textContent: `Author note` }))
      moreContentSummary.appendChild(super.createEl('div', { textContent: this.options_.summary }))

      moreContentEl.appendChild(moreContentSummary)
    }

    this.el().appendChild(moreContentEl)
  }

  private buildFlagStrings () {
    const flags = this.options_.flags
    const flagStrings: string[] = []

    if ((flags & NSFWFlag.VIOLENT) === NSFWFlag.VIOLENT) {
      flagStrings.push(this.player().localize(`Violence`))
    }

    if ((flags & NSFWFlag.EXPLICIT_SEX) === NSFWFlag.EXPLICIT_SEX) {
      flagStrings.push(this.player().localize(`Explicit Sex`))
    }

    return flagStrings
  }
}

videojs.registerComponent('PeerTubeNSFWComponent', PeerTubeNSFWComponent)

export {
  PeerTubeNSFWComponent
}
