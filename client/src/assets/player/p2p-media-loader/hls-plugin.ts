// Thanks https://github.com/streamroot/videojs-hlsjs-plugin
// We duplicated this plugin to choose the hls.js version we want, because streamroot only provide a bundled file

import * as Hlsjs from 'hls.js/dist/hls.light.js'
import videojs from 'video.js'
import { HlsjsConfigHandlerOptions, QualityLevelRepresentation, QualityLevels, VideoJSTechHLS } from '../peertube-videojs-typings'

type ErrorCounts = {
  [ type: string ]: number
}

type Metadata = {
  levels: Hlsjs.Level[]
}

type CustomAudioTrack = Hlsjs.AudioTrack & { name?: string, lang?: string }

const registerSourceHandler = function (vjs: typeof videojs) {
  if (!Hlsjs.isSupported()) {
    console.warn('Hls.js is not supported in this browser!')
    return
  }

  const html5 = vjs.getTech('Html5')

  if (!html5) {
    console.error('Not supported version if video.js')
    return
  }

  // FIXME: typings
  (html5 as any).registerSourceHandler({
    canHandleSource: function (source: videojs.Tech.SourceObject) {
      const hlsTypeRE = /^application\/x-mpegURL|application\/vnd\.apple\.mpegurl$/i
      const hlsExtRE = /\.m3u8/i

      if (hlsTypeRE.test(source.type)) return 'probably'
      if (hlsExtRE.test(source.src)) return 'maybe'

      return ''
    },

    handleSource: function (source: videojs.Tech.SourceObject, tech: VideoJSTechHLS) {
      if (tech.hlsProvider) {
        tech.hlsProvider.dispose()
      }

      tech.hlsProvider = new Html5Hlsjs(vjs, source, tech)

      return tech.hlsProvider
    }
  }, 0);

  // FIXME: typings
  (vjs as any).Html5Hlsjs = Html5Hlsjs
}

function hlsjsConfigHandler (this: videojs.Player, options: HlsjsConfigHandlerOptions) {
  const player = this

  if (!options) return

  if (!player.srOptions_) {
    player.srOptions_ = {}
  }

  if (!player.srOptions_.hlsjsConfig) {
    player.srOptions_.hlsjsConfig = options.hlsjsConfig
  }

  if (!player.srOptions_.captionConfig) {
    player.srOptions_.captionConfig = options.captionConfig
  }

  if (options.levelLabelHandler && !player.srOptions_.levelLabelHandler) {
    player.srOptions_.levelLabelHandler = options.levelLabelHandler
  }
}

const registerConfigPlugin = function (vjs: typeof videojs) {
  // Used in Brightcove since we don't pass options directly there
  const registerVjsPlugin = vjs.registerPlugin || vjs.plugin
  registerVjsPlugin('hlsjs', hlsjsConfigHandler)
}

class Html5Hlsjs {
  private static readonly hooks: { [id: string]: Function[] } = {}

  private readonly videoElement: HTMLVideoElement
  private readonly errorCounts: ErrorCounts = {}
  private readonly player: videojs.Player
  private readonly tech: videojs.Tech
  private readonly source: videojs.Tech.SourceObject
  private readonly vjs: typeof videojs

  private hls: Hlsjs & { manualLevel?: number, audioTrack?: any, audioTracks?: CustomAudioTrack[] } // FIXME: typings
  private hlsjsConfig: Partial<Hlsjs.Config & { cueHandler: any }> = null

  private _duration: number = null
  private metadata: Metadata = null
  private isLive: boolean = null
  private dvrDuration: number = null
  private edgeMargin: number = null

  private handlers: { [ id in 'play' | 'addtrack' | 'playing' | 'textTracksChange' | 'audioTracksChange' ]: EventListener } = {
    play: null,
    addtrack: null,
    playing: null,
    textTracksChange: null,
    audioTracksChange: null
  }

  private uiTextTrackHandled = false

  constructor (vjs: typeof videojs, source: videojs.Tech.SourceObject, tech: videojs.Tech) {
    this.vjs = vjs
    this.source = source

    this.tech = tech;
    (this.tech as any).name_ = 'Hlsjs'

    this.videoElement = tech.el() as HTMLVideoElement
    this.player = vjs((tech.options_ as any).playerId)

    this.videoElement.addEventListener('error', event => {
      let errorTxt: string
      const mediaError = (event.currentTarget as HTMLVideoElement).error

      switch (mediaError.code) {
        case mediaError.MEDIA_ERR_ABORTED:
          errorTxt = 'You aborted the video playback'
          break
        case mediaError.MEDIA_ERR_DECODE:
          errorTxt = 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support'
          this._handleMediaError(mediaError)
          break
        case mediaError.MEDIA_ERR_NETWORK:
          errorTxt = 'A network error caused the video download to fail part-way'
          break
        case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorTxt = 'The video could not be loaded, either because the server or network failed or because the format is not supported'
          break

        default:
          errorTxt = mediaError.message
      }

      console.error('MEDIA_ERROR: ', errorTxt)
    })

    this.initialize()
  }

  duration () {
    return this._duration || this.videoElement.duration || 0
  }

  seekable () {
    if (this.hls.media) {
      if (!this.isLive) {
        return this.vjs.createTimeRanges(0, this.hls.media.duration)
      }

      // Video.js doesn't seem to like floating point timeranges
      const startTime = Math.round(this.hls.media.duration - this.dvrDuration)
      const endTime = Math.round(this.hls.media.duration - this.edgeMargin)

      return this.vjs.createTimeRanges(startTime, endTime)
    }

    return this.vjs.createTimeRanges()
  }

  // See comment for `initialize` method.
  dispose () {
    this.videoElement.removeEventListener('play', this.handlers.play)
    this.videoElement.textTracks.removeEventListener('addtrack', this.handlers.addtrack)
    this.videoElement.removeEventListener('playing', this.handlers.playing)

    this.player.textTracks().removeEventListener('change', this.handlers.textTracksChange)
    this.uiTextTrackHandled = false

    this.hls.destroy()
  }

  static addHook (type: string, callback: Function) {
    Html5Hlsjs.hooks[ type ] = this.hooks[ type ] || []
    Html5Hlsjs.hooks[ type ].push(callback)
  }

  static removeHook (type: string, callback: Function) {
    if (Html5Hlsjs.hooks[ type ] === undefined) return false

    const index = Html5Hlsjs.hooks[ type ].indexOf(callback)
    if (index === -1) return false

    Html5Hlsjs.hooks[ type ].splice(index, 1)

    return true
  }

  private _executeHooksFor (type: string) {
    if (Html5Hlsjs.hooks[ type ] === undefined) {
      return
    }

    // ES3 and IE < 9
    for (let i = 0; i < Html5Hlsjs.hooks[ type ].length; i++) {
      Html5Hlsjs.hooks[ type ][ i ](this.player, this.hls)
    }
  }

  private _handleMediaError (error: any) {
    if (this.errorCounts[ Hlsjs.ErrorTypes.MEDIA_ERROR ] === 1) {
      console.info('trying to recover media error')
      this.hls.recoverMediaError()
      return
    }

    if (this.errorCounts[ Hlsjs.ErrorTypes.MEDIA_ERROR ] === 2) {
      console.info('2nd try to recover media error (by swapping audio codec')
      this.hls.swapAudioCodec()
      this.hls.recoverMediaError()
      return
    }

    if (this.errorCounts[ Hlsjs.ErrorTypes.MEDIA_ERROR ] > 2) {
      console.info('bubbling media error up to VIDEOJS')
      this.tech.error = () => error
      this.tech.trigger('error')
      return
    }
  }

  private _onError (_event: any, data: Hlsjs.errorData) {
    const error: { message: string, code?: number } = {
      message: `HLS.js error: ${data.type} - fatal: ${data.fatal} - ${data.details}`
    }
    console.error(error.message)

    // increment/set error count
    if (this.errorCounts[ data.type ]) this.errorCounts[ data.type ] += 1
    else this.errorCounts[ data.type ] = 1

    // Implement simple error handling based on hls.js documentation
    // https://github.com/dailymotion/hls.js/blob/master/API.md#fifth-step-error-handling
    if (data.fatal) {
      switch (data.type) {
        case Hlsjs.ErrorTypes.NETWORK_ERROR:
          console.info('bubbling network error up to VIDEOJS')
          error.code = 2
          this.tech.error = () => error as any
          this.tech.trigger('error')
          break

        case Hlsjs.ErrorTypes.MEDIA_ERROR:
          error.code = 3
          this._handleMediaError(error)
          break

        default:
          // cannot recover
          this.hls.destroy()
          console.info('bubbling error up to VIDEOJS')
          this.tech.error = () => error as any
          this.tech.trigger('error')
          break
      }
    }
  }

  private switchQuality (qualityId: number) {
    this.hls.nextLevel = qualityId
  }

  private _levelLabel (level: Hlsjs.Level) {
    if (this.player.srOptions_.levelLabelHandler) {
      return this.player.srOptions_.levelLabelHandler(level)
    }

    if (level.height) return level.height + 'p'
    if (level.width) return Math.round(level.width * 9 / 16) + 'p'
    if (level.bitrate) return (level.bitrate / 1000) + 'kbps'

    return 0
  }

  private _relayQualityChange (qualityLevels: QualityLevels) {
    // Determine if it is "Auto" (all tracks enabled)
    let isAuto = true

    for (let i = 0; i < qualityLevels.length; i++) {
      if (!qualityLevels[ i ]._enabled) {
        isAuto = false
        break
      }
    }

    // Interact with ME
    if (isAuto) {
      this.hls.currentLevel = -1
      return
    }

    // Find ID of highest enabled track
    let selectedTrack: number

    for (selectedTrack = qualityLevels.length - 1; selectedTrack >= 0; selectedTrack--) {
      if (qualityLevels[ selectedTrack ]._enabled) {
        break
      }
    }

    this.hls.currentLevel = selectedTrack
  }

  private _handleQualityLevels () {
    if (!this.metadata) return

    const qualityLevels = this.player.qualityLevels && this.player.qualityLevels()
    if (!qualityLevels) return

    for (let i = 0; i < this.metadata.levels.length; i++) {
      const details = this.metadata.levels[ i ]
      const representation: QualityLevelRepresentation = {
        id: i,
        width: details.width,
        height: details.height,
        bandwidth: details.bitrate,
        bitrate: details.bitrate,
        _enabled: true
      }

      const self = this
      representation.enabled = function (this: QualityLevels, level: number, toggle?: boolean) {
        // Brightcove switcher works TextTracks-style (enable tracks that it wants to ABR on)
        if (typeof toggle === 'boolean') {
          this[ level ]._enabled = toggle
          self._relayQualityChange(this)
        }

        return this[ level ]._enabled
      }

      qualityLevels.addQualityLevel(representation)
    }
  }

  private _notifyVideoQualities () {
    if (!this.metadata) return
    const cleanTracklist = []

    if (this.metadata.levels.length > 1) {
      const autoLevel = {
        id: -1,
        label: 'auto',
        selected: this.hls.manualLevel === -1
      }
      cleanTracklist.push(autoLevel)
    }

    this.metadata.levels.forEach((level, index) => {
      // Don't write in level (shared reference with Hls.js)
      const quality = {
        id: index,
        selected: index === this.hls.manualLevel,
        label: this._levelLabel(level)
      }

      cleanTracklist.push(quality)
    })

    const payload = {
      qualityData: { video: cleanTracklist },
      qualitySwitchCallback: this.switchQuality.bind(this)
    }

    this.tech.trigger('loadedqualitydata', payload)

    // Self-de-register so we don't raise the payload multiple times
    this.videoElement.removeEventListener('playing', this.handlers.playing)
  }

  private _updateSelectedAudioTrack () {
    const playerAudioTracks = this.tech.audioTracks()
    for (let j = 0; j < playerAudioTracks.length; j++) {
      // FIXME: typings
      if ((playerAudioTracks[ j ] as any).enabled) {
        this.hls.audioTrack = j
        break
      }
    }
  }

  private _onAudioTracks () {
    const hlsAudioTracks = this.hls.audioTracks
    const playerAudioTracks = this.tech.audioTracks()

    if (hlsAudioTracks.length > 1 && playerAudioTracks.length === 0) {
      // Add Hls.js audio tracks if not added yet
      for (let i = 0; i < hlsAudioTracks.length; i++) {
        playerAudioTracks.addTrack(new this.vjs.AudioTrack({
          id: i.toString(),
          kind: 'alternative',
          label: hlsAudioTracks[ i ].name || hlsAudioTracks[ i ].lang,
          language: hlsAudioTracks[ i ].lang,
          enabled: i === this.hls.audioTrack
        }))
      }

      // Handle audio track change event
      this.handlers.audioTracksChange = this._updateSelectedAudioTrack.bind(this)
      playerAudioTracks.addEventListener('change', this.handlers.audioTracksChange)
    }
  }

  private _getTextTrackLabel (textTrack: TextTrack) {
    // Label here is readable label and is optional (used in the UI so if it is there it should be different)
    return textTrack.label ? textTrack.label : textTrack.language
  }

  private _isSameTextTrack (track1: TextTrack, track2: TextTrack) {
    return this._getTextTrackLabel(track1) === this._getTextTrackLabel(track2)
      && track1.kind === track2.kind
  }

  private _updateSelectedTextTrack () {
    const playerTextTracks = this.player.textTracks()
    let activeTrack: TextTrack = null

    for (let j = 0; j < playerTextTracks.length; j++) {
      if (playerTextTracks[ j ].mode === 'showing') {
        activeTrack = playerTextTracks[ j ]
        break
      }
    }

    const hlsjsTracks = this.videoElement.textTracks
    for (let k = 0; k < hlsjsTracks.length; k++) {
      if (hlsjsTracks[ k ].kind === 'subtitles' || hlsjsTracks[ k ].kind === 'captions') {
        hlsjsTracks[ k ].mode = activeTrack && this._isSameTextTrack(hlsjsTracks[ k ], activeTrack)
          ? 'showing'
          : 'disabled'
      }
    }
  }

  private _startLoad () {
    this.hls.startLoad(-1)
    this.videoElement.removeEventListener('play', this.handlers.play)
  }

  private _oneLevelObjClone (obj: object) {
    const result = {}
    const objKeys = Object.keys(obj)
    for (let i = 0; i < objKeys.length; i++) {
      result[ objKeys[ i ] ] = obj[ objKeys[ i ] ]
    }

    return result
  }

  private _filterDisplayableTextTracks (textTracks: TextTrackList) {
    const displayableTracks = []

    // Filter out tracks that is displayable (captions or subtitles)
    for (let idx = 0; idx < textTracks.length; idx++) {
      if (textTracks[ idx ].kind === 'subtitles' || textTracks[ idx ].kind === 'captions') {
        displayableTracks.push(textTracks[ idx ])
      }
    }

    return displayableTracks
  }

  private _updateTextTrackList () {
    const displayableTracks = this._filterDisplayableTextTracks(this.videoElement.textTracks)
    const playerTextTracks = this.player.textTracks()

    // Add stubs to make the caption switcher shows up
    // Adding the Hls.js text track in will make us have double captions
    for (let idx = 0; idx < displayableTracks.length; idx++) {
      let isAdded = false

      for (let jdx = 0; jdx < playerTextTracks.length; jdx++) {
        if (this._isSameTextTrack(displayableTracks[ idx ], playerTextTracks[ jdx ])) {
          isAdded = true
          break
        }
      }

      if (!isAdded) {
        const hlsjsTextTrack = displayableTracks[ idx ]
        this.player.addRemoteTextTrack({
          kind: hlsjsTextTrack.kind as videojs.TextTrack.Kind,
          label: this._getTextTrackLabel(hlsjsTextTrack),
          language: hlsjsTextTrack.language,
          srclang: hlsjsTextTrack.language
        }, false)
      }
    }

    // Handle UI switching
    this._updateSelectedTextTrack()

    if (!this.uiTextTrackHandled) {
      this.handlers.textTracksChange = this._updateSelectedTextTrack.bind(this)
      playerTextTracks.addEventListener('change', this.handlers.textTracksChange)

      this.uiTextTrackHandled = true
    }
  }

  private _onMetaData (_event: any, data: Hlsjs.manifestLoadedData) {
    // This could arrive before 'loadedqualitydata' handlers is registered, remember it so we can raise it later
    this.metadata = data as any
    this._handleQualityLevels()
  }

  private _createCueHandler (captionConfig: any) {
    return {
      newCue: (track: any, startTime: number, endTime: number, captionScreen: { rows: any[] }) => {
        let row: any
        let cue: VTTCue
        let text: string
        const VTTCue = (window as any).VTTCue || (window as any).TextTrackCue

        for (let r = 0; r < captionScreen.rows.length; r++) {
          row = captionScreen.rows[ r ]
          text = ''

          if (!row.isEmpty()) {
            for (let c = 0; c < row.chars.length; c++) {
              text += row.chars[ c ].ucharj
            }

            cue = new VTTCue(startTime, endTime, text.trim())

            // typeof null === 'object'
            if (captionConfig != null && typeof captionConfig === 'object') {
              // Copy client overridden property into the cue object
              const configKeys = Object.keys(captionConfig)

              for (let k = 0; k < configKeys.length; k++) {
                cue[ configKeys[ k ] ] = captionConfig[ configKeys[ k ] ]
              }
            }
            track.addCue(cue)
            if (endTime === startTime) track.addCue(new VTTCue(endTime + 5, ''))
          }
        }
      }
    }
  }

  private _initHlsjs () {
    const techOptions = this.tech.options_ as HlsjsConfigHandlerOptions
    const srOptions_ = this.player.srOptions_

    const hlsjsConfigRef = srOptions_ && srOptions_.hlsjsConfig || techOptions.hlsjsConfig
    // Hls.js will write to the reference thus change the object for later streams
    this.hlsjsConfig = hlsjsConfigRef ? this._oneLevelObjClone(hlsjsConfigRef) : {}

    if ([ '', 'auto' ].includes(this.videoElement.preload) && !this.videoElement.autoplay && this.hlsjsConfig.autoStartLoad === undefined) {
      this.hlsjsConfig.autoStartLoad = false
    }

    const captionConfig = srOptions_ && srOptions_.captionConfig || techOptions.captionConfig
    if (captionConfig) {
      this.hlsjsConfig.cueHandler = this._createCueHandler(captionConfig)
    }

    // If the user explicitly sets autoStartLoad to false, we're not going to enter the if block above
    // That's why we have a separate if block here to set the 'play' listener
    if (this.hlsjsConfig.autoStartLoad === false) {
      this.handlers.play = this._startLoad.bind(this)
      this.videoElement.addEventListener('play', this.handlers.play)
    }

    // _notifyVideoQualities sometimes runs before the quality picker event handler is registered -> no video switcher
    this.handlers.playing = this._notifyVideoQualities.bind(this)
    this.videoElement.addEventListener('playing', this.handlers.playing)

    this.hls = new Hlsjs(this.hlsjsConfig)

    this._executeHooksFor('beforeinitialize')

    this.hls.on(Hlsjs.Events.ERROR, (event, data) => this._onError(event, data))
    this.hls.on(Hlsjs.Events.AUDIO_TRACKS_UPDATED, () => this._onAudioTracks())
    this.hls.on(Hlsjs.Events.MANIFEST_PARSED, (event, data) => this._onMetaData(event, data as any)) // FIXME: typings
    this.hls.on(Hlsjs.Events.LEVEL_LOADED, (event, data) => {
      // The DVR plugin will auto seek to "live edge" on start up
      if (this.hlsjsConfig.liveSyncDuration) {
        this.edgeMargin = this.hlsjsConfig.liveSyncDuration
      } else if (this.hlsjsConfig.liveSyncDurationCount) {
        this.edgeMargin = this.hlsjsConfig.liveSyncDurationCount * data.details.targetduration
      }

      this.isLive = data.details.live
      this.dvrDuration = data.details.totalduration
      this._duration = this.isLive ? Infinity : data.details.totalduration
    })
    this.hls.once(Hlsjs.Events.FRAG_LOADED, () => {
      // Emit custom 'loadedmetadata' event for parity with `videojs-contrib-hls`
      // Ref: https://github.com/videojs/videojs-contrib-hls#loadedmetadata
      this.tech.trigger('loadedmetadata')
    })

    this.hls.attachMedia(this.videoElement)

    this.handlers.addtrack = this._updateTextTrackList.bind(this)
    this.videoElement.textTracks.addEventListener('addtrack', this.handlers.addtrack)

    this.hls.loadSource(this.source.src)
  }

  private initialize () {
    this._initHlsjs()
  }
}

export {
  Html5Hlsjs,
  registerSourceHandler,
  registerConfigPlugin
}
