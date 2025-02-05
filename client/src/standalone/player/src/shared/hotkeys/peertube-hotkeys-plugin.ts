import videojs from 'video.js'

type KeyHandler = { accept: (event: KeyboardEvent) => boolean, cb: (e: KeyboardEvent) => void }

const Plugin = videojs.getPlugin('plugin')

export type HotkeysOptions = {
  isLive: boolean
}

class PeerTubeHotkeysPlugin extends Plugin {
  private static readonly VOLUME_STEP = 0.1
  private static readonly SEEK_STEP = 5

  declare private readonly handleKeyFunction: (event: KeyboardEvent) => void

  declare private readonly handlers: KeyHandler[]

  declare private readonly isLive: boolean

  constructor (player: videojs.Player, options: videojs.PlayerOptions & HotkeysOptions) {
    super(player, options)

    this.isLive = options.isLive

    this.handlers = this.buildHandlers()

    this.handleKeyFunction = (event: KeyboardEvent) => this.onKeyDown(event)
    document.addEventListener('keydown', this.handleKeyFunction)
  }

  dispose () {
    document.removeEventListener('keydown', this.handleKeyFunction)

    super.dispose()
  }

  private onKeyDown (event: KeyboardEvent) {
    if (!this.isValidKeyTarget(event.target as HTMLElement)) return

    for (const handler of this.handlers) {
      if (handler.accept(event)) {
        handler.cb(event)
        return
      }
    }
  }

  private buildHandlers () {
    const handlers: KeyHandler[] = [
      // Play
      {
        accept: e => (e.key === ' ' || e.key === 'MediaPlayPause'),
        cb: e => {
          e.preventDefault()
          e.stopPropagation()

          if (this.player.paused()) this.player.play()
          else this.player.pause()
        }
      },

      // Increase volume
      {
        accept: e => this.isNaked(e, 'ArrowUp'),
        cb: e => {
          e.preventDefault()
          this.player.volume(this.player.volume() + PeerTubeHotkeysPlugin.VOLUME_STEP)
        }
      },

      // Decrease volume
      {
        accept: e => this.isNaked(e, 'ArrowDown'),
        cb: e => {
          e.preventDefault()
          this.player.volume(this.player.volume() - PeerTubeHotkeysPlugin.VOLUME_STEP)
        }
      },

      // Fullscreen
      {
        // f key or Ctrl + Enter
        accept: e => this.isNaked(e, 'f') || (!e.altKey && e.ctrlKey && e.key === 'Enter'),
        cb: e => {
          e.preventDefault()

          if (this.player.isFullscreen()) this.player.exitFullscreen()
          else this.player.requestFullscreen()
        }
      },

      // Mute
      {
        accept: e => this.isNaked(e, 'm'),
        cb: e => {
          e.preventDefault()

          this.player.muted(!this.player.muted())
        }
      },

      // Increase playback rate
      {
        accept: e => e.key === '>',
        cb: () => {
          if (this.isLive) return

          const target = Math.min(this.player.playbackRate() + 0.1, 5)

          this.player.playbackRate(parseFloat(target.toFixed(2)))
        }
      },

      // Decrease playback rate
      {
        accept: e => e.key === '<',
        cb: () => {
          if (this.isLive) return

          const target = Math.max(this.player.playbackRate() - 0.1, 0.10)

          this.player.playbackRate(parseFloat(target.toFixed(2)))
        }
      },

      // Previous frame
      {
        accept: e => e.key === ',',
        cb: () => {
          if (this.isLive) return

          this.player.pause()

          // Calculate movement distance (assuming 30 fps)
          const dist = 1 / 30
          this.player.currentTime(this.player.currentTime() - dist)
        }
      },

      // Next frame
      {
        accept: e => e.key === '.',
        cb: () => {
          if (this.isLive) return

          this.player.pause()

          // Calculate movement distance (assuming 30 fps)
          const dist = 1 / 30
          this.player.currentTime(this.player.currentTime() + dist)
        }
      }
    ]

    if (this.isLive) return handlers

    return handlers.concat(this.buildVODHandlers())
  }

  private buildVODHandlers () {
    const handlers: KeyHandler[] = [
      // Rewind
      {
        accept: e => this.isNaked(e, 'ArrowLeft') || this.isNaked(e, 'MediaRewind'),
        cb: e => {
          if (this.isLive) return

          e.preventDefault()

          const target = Math.max(0, this.player.currentTime() - PeerTubeHotkeysPlugin.SEEK_STEP)
          this.player.currentTime(target)
        }
      },

      // Forward
      {
        accept: e => this.isNaked(e, 'ArrowRight') || this.isNaked(e, 'MediaForward'),
        cb: e => {
          if (this.isLive) return

          e.preventDefault()

          const target = Math.min(this.player.duration(), this.player.currentTime() + PeerTubeHotkeysPlugin.SEEK_STEP)
          this.player.currentTime(target)
        }
      }
    ]

    // 0-9 key handlers
    for (let i = 0; i < 10; i++) {
      handlers.push({
        accept: e => this.isNakedOrShift(e, i + ''),
        cb: e => {
          if (this.isLive) return

          e.preventDefault()

          this.player.currentTime(this.player.duration() * i * 0.1)
        }
      })
    }

    return handlers
  }

  private isValidKeyTarget (eventEl: HTMLElement) {
    const playerEl = this.player.el()
    const activeEl = document.activeElement
    const currentElTagName = eventEl.tagName.toLowerCase()

    return (
      activeEl === playerEl ||
      activeEl === playerEl.querySelector('.vjs-tech') ||
      activeEl === playerEl.querySelector('.vjs-control-bar') ||
      eventEl.id === 'content' ||
      currentElTagName === 'body' ||
      currentElTagName === 'video'
    )
  }

  private isNaked (event: KeyboardEvent, key: string) {
    if (key.length === 1) key = key.toUpperCase()

    return (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && this.getLatinKey(event.key, event.code) === key)
  }

  private isNakedOrShift (event: KeyboardEvent, key: string) {
    return (!event.ctrlKey && !event.altKey && !event.metaKey && event.key === key)
  }

  // Thanks Maciej Krawczyk
  // https://stackoverflow.com/questions/70211837/keyboard-shortcuts-commands-on-non-latin-alphabet-keyboards-javascript?rq=1
  private getLatinKey (key: string, code: string) {
    if (key.length !== 1) {
      return key
    }

    const capitalHetaCode = 880
    const isNonLatin = key.charCodeAt(0) >= capitalHetaCode

    if (isNonLatin) {
      if (code.indexOf('Key') === 0 && code.length === 4) { // i.e. 'KeyW'
        return code.charAt(3)
      }

      if (code.indexOf('Digit') === 0 && code.length === 6) { // i.e. 'Digit7'
        return code.charAt(5)
      }
    }

    return key.toUpperCase()
  }
}

videojs.registerPlugin('peerTubeHotkeysPlugin', PeerTubeHotkeysPlugin)
export { PeerTubeHotkeysPlugin }
