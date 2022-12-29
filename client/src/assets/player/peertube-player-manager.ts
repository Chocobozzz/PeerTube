import '@peertube/videojs-contextmenu'
import './shared/upnext/end-card'
import './shared/upnext/upnext-plugin'
import './shared/stats/stats-card'
import './shared/stats/stats-plugin'
import './shared/bezels/bezels-plugin'
import './shared/peertube/peertube-plugin'
import './shared/resolutions/peertube-resolutions-plugin'
import './shared/control-bar/next-previous-video-button'
import './shared/control-bar/p2p-info-button'
//import './shared/control-bar/peertube-link-button'
import './shared/control-bar/picture-in-picture-bastyon'
import './shared/control-bar/peertube-load-progress-bar'
import './shared/control-bar/theater-button'
import './shared/settings/resolution-menu-button'
import './shared/settings/resolution-menu-item'
import './shared/settings/settings-dialog'
import './shared/settings/settings-menu-button'
import './shared/settings/settings-menu-item'
import './shared/settings/settings-panel'
import './shared/settings/settings-panel-child'
import './shared/playlist/playlist-plugin'
import './shared/mobile/peertube-mobile-plugin'
import './shared/mobile/peertube-mobile-buttons'
import './shared/hotkeys/peertube-hotkeys-plugin'
import "./shared/videojs-helpers/hotkeys.js";

import videojs from 'video.js'
import { logger } from '@root-helpers/logger'
import { isMobile } from '@root-helpers/web-browser'
import { saveAverageBandwidth } from './peertube-player-local-storage'
import { ManagerOptionsBuilder } from './shared/manager-options'
import { TranslationsManager } from './translations-manager'
import { CommonOptions, PeertubePlayerManagerOptions, PlayerMode, PlayerNetworkInfo } from './types'
import './shared/p2p-media-loader/p2p-media-loader-plugin'
import * as p2pMediaLoaderModule from 'p2p-media-loader-hlsjs-basyton'


console.log('p2pMediaLoaderModule', p2pMediaLoaderModule)


const Fn: any = require('./shared/videojs-helpers/fn.js');


const Slider = videojs.getComponent('Slider') as any
const SeekBar = videojs.getComponent('SeekBar') as any

Slider.prototype.update = function(){

    // In VolumeBar init we have a setTimeout for update that pops and update
    // to the end of the execution stack. The player is destroyed before then
    // update will cause an error
    // If there's no bar...
    if (!this.el_ || !this.bar) {
      return;
    }

    // clamp progress between 0 and 1
    // and only round to four decimal places, as we round to two below
    const progress = this.getProgress();

    if (progress === this.progress_) {
      return progress;
    }

    this.progress_ = progress;

    // Set the new bar width or height
    var el = this.bar.el()

    if(!this.vertical()){
      //el.style['transform-origin'] = 'left'
      el.style['transform'] = 'scaleX('+(progress).toFixed(2)+')'
    }
    else{
      el.style['transform-origin'] = 'bottom'
      el.style['transform'] = 'scaleY('+(progress).toFixed(2)+')'
    }

    return progress;
}

SeekBar.prototype.getPercent = function getPercent () {
  const time = this.player_.currentTime()
  const percent = time / this.player_.duration()
  return percent >= 1 ? 1 : percent
}

SeekBar.prototype.setEventHandlers_ = function () {

  this.update_ = Fn.bind(this, this.update);
  this.update = Fn.throttle(this.update_, Fn.UPDATE_REFRESH_INTERVAL);

  this.on(this.player_, ['ended', 'durationchange', 'timeupdate'], this.update);
  if (this.player_.liveTracker) {
    this.on(this.player_.liveTracker, 'liveedgechange', this.update);
  }

  // when playing, let's ensure we smoothly update the play progress bar
  // via an interval
  this.updateInterval = null;

  this.enableIntervalHandler_ = (e :any) => this.enableInterval_(e);
  this.disableIntervalHandler_ = (e :any) => this.disableInterval_(e);

  this.on(this.player_, ['playing'], this.enableIntervalHandler_);

  this.on(this.player_, ['ended', 'pause', 'waiting'], this.disableIntervalHandler_);

  // we don't need to update the play progress if the document is hidden,
  // also, this causes the CPU to spike and eventually crash the page on IE11.
  if ('hidden' in document && 'visibilityState' in document) {
    this.on(document, 'visibilitychange', this.toggleVisibility_);
  }
}

SeekBar.prototype.enableInterval_ = function() {
  if (this.updateInterval) {
    return;

  }
  this.updateInterval = this.setInterval(this.update, Fn.UPDATE_REFRESH_INTERVAL);
}

SeekBar.prototype.update = function (event : any) {
  if (document.visibilityState === 'hidden') {
    return;
  }

  const percent = this.getPercent();

  var el = this.bar.el()

  el.style['transform-origin'] = 'left'
  el.style['transform'] = 'scaleX('+(percent).toFixed(2)+')'

  return percent;
  
}
/*
SeekBar.prototype.handleMouseMove = function handleMouseMove (event: any) {

  let newTime = this.calculateDistance(event) * this.player_.duration()
  if (newTime === this.player_.duration()) {
    newTime = newTime - 0.1
  }

  this.player_.currentTime(newTime)
  this.update()
}

SeekBar.prototype.handleMouseUp = function handleMouseUp (event: any) {

  console.log('this.super', this, SeekBar, SeekBar.prototype)


  console.log('this.super', this.super)
  console.log('this.super', SeekBar.prototype.super)

  this.super.handleMouseUp.call(this.super, event);

  // Stop event propagation to prevent double fire in progress-control.js
  if (event) {
    event.stopPropagation();
  }
  this.player_.scrubbing(false);


  this.player_.trigger({ type: 'timeupdate', target: this, manuallyTriggered: true });
  if (this.videoWasPlaying) {
    this.player_.play().catch(e => {
      console.error('e', e)
    })
  } else {
    this.update_();
  }
}*/

// Change 'Playback Rate' to 'Speed' (smaller for our settings menu)
//(videojs.getComponent('PlaybackRateMenuButton') as any).prototype.controlText_ = 'Speed'

const CaptionsButton = videojs.getComponent('CaptionsButton') as any
// Change Captions to Subtitles/CC
CaptionsButton.prototype.controlText_ = 'Subtitles/CC'
// We just want to display 'Off' instead of 'captions off', keep a space so the variable == true (hacky I know)
CaptionsButton.prototype.label_ = ' '

export class PeertubePlayerManager {
  private static playerElementClassName: string
  private static onPlayerChange: (player: videojs.Player) => void
  private static alreadyPlayed = false
  //private static pluginsManager: PluginsManager

  private static videojsDecodeErrors = 0


  private static p2pMediaLoaderModule: any

  static initState () {
    this.alreadyPlayed = false
  }

  static async initialize (mode: PlayerMode, options: PeertubePlayerManagerOptions, onPlayerChange: (player: videojs.Player) => void) {
    //this.pluginsManager = options.pluginsManager

    this.onPlayerChange = onPlayerChange
    this.playerElementClassName = options.common.playerElement.className

    //if (mode === 'webtorrent') await import('./shared/webtorrent/webtorrent-plugin')


    if (mode === 'p2p-media-loader') {
      this.p2pMediaLoaderModule = p2pMediaLoaderModule
    }


    return this.buildPlayer(mode, options)
  }

  private static async buildPlayer (mode: PlayerMode, options: PeertubePlayerManagerOptions): Promise<videojs.Player> {
    const videojsOptionsBuilder = new ManagerOptionsBuilder(mode, options, this.p2pMediaLoaderModule)
    const videojsOptions = videojsOptionsBuilder.getVideojsOptions(this.alreadyPlayed)

    /*const videojsOptions = await this.pluginsManager.runHook(
      'filter:internal.player.videojs.options.result',
      videojsOptionsBuilder.getVideojsOptions(this.alreadyPlayed)
    )*/

    console.log('videojsOptions', videojsOptions, options)

    const self = this
    return new Promise(res => {
      videojs(options.common.playerElement, videojsOptions, function (this: videojs.Player) {
        const player = this

        //let alreadyFallback = false

        const handleError = () => {
          //if (alreadyFallback) return
          //alreadyFallback = true

          if (mode === 'p2p-media-loader') {
            //self.tryToRecoverHLSError(player.error(), player, options)
          } else {
            /// remove torrent /// self.maybeFallbackToWebTorrent(mode, player, options)
          }
        }

        player.one('error', () => handleError())

        player.one('play', () => {
          self.alreadyPlayed = true
        })

        self.addContextMenu(videojsOptionsBuilder, player, options.common)

        if (isMobile() || options.mobile) player.peertubeMobile()
        //if (options.common.enableHotkeys === true) player.peerTubeHotkeysPlugin()
        if (options.common.controlBar === false) player.controlBar.addClass('control-bar-hidden')

        player.bezels()

        if(mode != 'localvideo'){
          
          player.stats({
            videoUUID: options.common.videoUUID,
            videoIsLive: options.common.isLive,
            mode,
            p2pEnabled: options.common.p2pEnabled
          })

          player.on('p2pInfo', (_, data: PlayerNetworkInfo) => {
            if (data.source !== 'p2p-media-loader' || isNaN(data.bandwidthEstimate)) return

            saveAverageBandwidth(data.bandwidthEstimate)
          })

        }
        else{
          player.on('durationchange', () => {
            if(player.duration() != options.common.videoDuration)
              player.duration(options.common.videoDuration)
          })

        }

        return res(player)
      })
    })
  }

  private static async tryToRecoverHLSError (err: any, currentPlayer: videojs.Player, options: PeertubePlayerManagerOptions) {
    if (err.code === 3) { // Decode error

      // Display a notification to user
      if (this.videojsDecodeErrors === 0) {
        options.common.errorNotifier(currentPlayer.localize('The video failed to play, will try to fast forward.'))
      }

      if (this.videojsDecodeErrors === 20) {
        this.maybeFallbackToWebTorrent('p2p-media-loader', currentPlayer, options)
        return
      }

      logger.info('Fast forwarding HLS to recover from an error.')

      this.videojsDecodeErrors++

      options.common.startTime = currentPlayer.currentTime() + 2
      options.common.autoplay = true
      this.rebuildAndUpdateVideoElement(currentPlayer, options.common)

      const newPlayer = await this.buildPlayer('p2p-media-loader', options)
      this.onPlayerChange(newPlayer)
    } else {
      this.maybeFallbackToWebTorrent('p2p-media-loader', currentPlayer, options)
    }
  }

  private static async maybeFallbackToWebTorrent (
    currentMode: PlayerMode,
    currentPlayer: videojs.Player,
    options: PeertubePlayerManagerOptions
  ) {

    console.log('maybeFallbackToWebTorrent')

    if (options.webtorrent.videoFiles.length === 0 || currentMode === 'webtorrent') {
      currentPlayer.peertube().displayFatalError()
      return
    }

    logger.info('Fallback to webtorrent.')

    this.rebuildAndUpdateVideoElement(currentPlayer, options.common)

    //await import('./shared/webtorrent/webtorrent-plugin')

    const newPlayer = await this.buildPlayer('webtorrent', options)
    this.onPlayerChange(newPlayer)
  }

  private static rebuildAndUpdateVideoElement (player: videojs.Player, commonOptions: CommonOptions) {
    const newVideoElement = document.createElement('video')
    newVideoElement.className = this.playerElementClassName

    // VideoJS wraps our video element inside a div
    let currentParentPlayerElement = commonOptions.playerElement.parentNode
    // Fix on IOS, don't ask me why
    if (!currentParentPlayerElement) currentParentPlayerElement = document.getElementById(commonOptions.playerElement.id).parentNode

    currentParentPlayerElement.parentNode.insertBefore(newVideoElement, currentParentPlayerElement)

    commonOptions.playerElement = newVideoElement
    commonOptions.onPlayerElementChange(newVideoElement)

    player.dispose()

    return newVideoElement
  }

  private static addContextMenu (optionsBuilder: ManagerOptionsBuilder, player: videojs.Player, commonOptions: CommonOptions) {
    const options = optionsBuilder.getContextMenuOptions(player, commonOptions)

    player.contextmenuUI(options)
  }
}

// ############################################################################

export {
  videojs
}
