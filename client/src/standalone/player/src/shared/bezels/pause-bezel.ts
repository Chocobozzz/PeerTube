import videojs from 'video.js'
import { isMobile } from '@root-helpers/web-browser'

function getPauseBezel () {
  return `
  <div class="vjs-bezels-pause">
    <div class="vjs-bezel" role="status" aria-label="Pause">
      <div class="vjs-bezel-icon">
        <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
          <use class="vjs-svg-shadow" xlink:href="#vjs-id-1"></use>
          <path class="vjs-svg-fill" d="M 12,26 16,26 16,10 12,10 z M 21,26 25,26 25,10 21,10 z" id="vjs-id-1"></path>
        </svg>
      </div>
    </div>
  </div>
  `
}

function getPlayBezel () {
  return `
  <div class="vjs-bezels-play">
    <div class="vjs-bezel" role="status" aria-label="Play">
      <div class="vjs-bezel-icon">
        <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
          <use class="vjs-svg-shadow" xlink:href="#vjs-id-2"></use>
          <path class="vjs-svg-fill" d="M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z" id="ytp-id-2"></path>
        </svg>
      </div>
    </div>
  </div>
  `
}

const Component = videojs.getComponent('Component')
export class PauseBezel extends Component {
  declare container: HTMLDivElement

  declare private firstPlayDone: boolean
  declare private paused: boolean

  declare private playerPauseHandler: () => void
  declare private playerPlayHandler: () => void
  declare private videoChangeHandler: () => void

  constructor (player: videojs.Player, options?: videojs.ComponentOptions) {
    super(player, options)

    // Hide bezels on mobile since we already have our mobile overlay
    if (isMobile()) return

    this.firstPlayDone = false
    this.paused = false

    this.playerPauseHandler = () => {
      if (player.seeking()) return

      this.paused = true

      if (player.ended()) return

      this.container.innerHTML = getPauseBezel()
      this.showBezel()
    }

    this.playerPlayHandler = () => {
      if (player.seeking() || !this.firstPlayDone || !this.paused) {
        this.firstPlayDone = true
        return
      }

      this.paused = false
      this.firstPlayDone = true

      this.container.innerHTML = getPlayBezel()
      this.showBezel()
    }

    this.videoChangeHandler = () => {
      this.firstPlayDone = false
    }

    player.on('video-change', () => this.videoChangeHandler)
    player.on('pause', this.playerPauseHandler)
    player.on('play', this.playerPlayHandler)
  }

  dispose () {
    if (this.playerPauseHandler) this.player().off('pause', this.playerPauseHandler)
    if (this.playerPlayHandler) this.player().off('play', this.playerPlayHandler)
    if (this.videoChangeHandler) this.player().off('video-change', this.videoChangeHandler)

    super.dispose()
  }

  createEl () {
    this.container = super.createEl('div', {
      className: 'vjs-bezels-content'
    }) as HTMLDivElement

    this.container.style.display = 'none'

    return this.container
  }

  showBezel () {
    this.container.style.display = 'inherit'

    setTimeout(() => {
      this.container.style.display = 'none'
    }, 500) // matching the animation duration
  }
}

videojs.registerComponent('PauseBezel', PauseBezel)
