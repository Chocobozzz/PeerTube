import videojs from 'video.js'
import { copyToClipboard } from '@root-helpers/utils'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { isIOS, isSafari } from '@root-helpers/web-browser'
import { buildVideoLink, decorateVideoLink, pick } from '@shared/core-utils'
import { isDefaultLocale } from '@shared/core-utils/i18n'
import { VideoJSPluginOptions } from '../../types'
import { CommonOptions, PeertubePlayerManagerOptions, PlayerMode } from '../../types/manager-options'
import { ControlBarOptionsBuilder } from './control-bar-options-builder'
import { HLSOptionsBuilder } from './hls-options-builder'
import { WebTorrentOptionsBuilder } from './webtorrent-options-builder'

export class ManagerOptionsBuilder {

  constructor (
    private mode: PlayerMode,
    private options: PeertubePlayerManagerOptions,
    private p2pMediaLoaderModule?: any
  ) {

  }

  getVideojsOptions (alreadyPlayed: boolean): videojs.PlayerOptions {
    const commonOptions = this.options.common

    let autoplay = this.getAutoPlayValue(commonOptions.autoplay, alreadyPlayed)
    const html5 = {
      preloadTextTracks: false
    }

    const plugins: VideoJSPluginOptions = {
      peertube: {
        mode: this.mode,
        autoplay, // Use peertube plugin autoplay because we could get the file by webtorrent

        ...pick(commonOptions, [
          'videoViewUrl',
          'authorizationHeader',
          'startTime',
          'videoDuration',
          'subtitle',
          'videoCaptions',
          'stopTime',
          'isLive',
          'videoUUID'
        ])
      }
    }

    if (commonOptions.playlist) {
      plugins.playlist = commonOptions.playlist
    }

    if (this.mode === 'p2p-media-loader') {
      const hlsOptionsBuilder = new HLSOptionsBuilder(this.options, this.p2pMediaLoaderModule)
      const options = hlsOptionsBuilder.getPluginOptions()

      Object.assign(plugins, pick(options, [ 'hlsjs', 'p2pMediaLoader' ]))
      Object.assign(html5, options.html5)
    } else if (this.mode === 'webtorrent') {
      const webtorrentOptionsBuilder = new WebTorrentOptionsBuilder(this.options, this.getAutoPlayValue(autoplay, alreadyPlayed))

      Object.assign(plugins, webtorrentOptionsBuilder.getPluginOptions())

      // WebTorrent plugin handles autoplay, because we do some hackish stuff in there
      autoplay = false
    }

    const controlBarOptionsBuilder = new ControlBarOptionsBuilder(this.options, this.mode)

    const videojsOptions = {
      html5,

      // We don't use text track settings for now
      textTrackSettings: false as any, // FIXME: typings
      controls: commonOptions.controls !== undefined ? commonOptions.controls : true,
      loop: commonOptions.loop !== undefined ? commonOptions.loop : false,

      muted: commonOptions.muted !== undefined
        ? commonOptions.muted
        : undefined, // Undefined so the player knows it has to check the local storage

      autoplay: this.getAutoPlayValue(autoplay, alreadyPlayed),

      poster: commonOptions.poster,
      inactivityTimeout: commonOptions.inactivityTimeout,
      playbackRates: [ 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 ],

      plugins,

      controlBar: {
        children: controlBarOptionsBuilder.getChildrenOptions() as any // FIXME: typings
      }
    }

    if (commonOptions.language && !isDefaultLocale(commonOptions.language)) {
      Object.assign(videojsOptions, { language: commonOptions.language })
    }

    return videojsOptions
  }

  private getAutoPlayValue (autoplay: any, alreadyPlayed: boolean) {
    if (autoplay !== true) return autoplay

    // On first play, disable autoplay to avoid issues
    // But if the player already played videos, we can safely autoplay next ones
    if (isIOS() || isSafari()) {
      return alreadyPlayed ? 'play' : false
    }

    return 'play'
  }

  getContextMenuOptions (player: videojs.Player, commonOptions: CommonOptions) {
    const content = () => {
      const isLoopEnabled = player.options_['loop']

      const items = [
        {
          icon: 'repeat',
          label: player.localize('Play in loop') + (isLoopEnabled ? '<span class="vjs-icon-tick-white"></span>' : ''),
          listener: function () {
            player.options_['loop'] = !isLoopEnabled
          }
        },
        {
          label: player.localize('Copy the video URL'),
          listener: function () {
            copyToClipboard(buildVideoLink({ shortUUID: commonOptions.videoShortUUID }))
          }
        },
        {
          label: player.localize('Copy the video URL at the current time'),
          listener: function (this: videojs.Player) {
            const url = buildVideoLink({ shortUUID: commonOptions.videoShortUUID })

            copyToClipboard(decorateVideoLink({ url, startTime: this.currentTime() }))
          }
        },
        {
          icon: 'code',
          label: player.localize('Copy embed code'),
          listener: () => {
            copyToClipboard(buildVideoOrPlaylistEmbed({ embedUrl: commonOptions.embedUrl, embedTitle: commonOptions.embedTitle }))
          }
        }
      ]

      if (this.mode === 'webtorrent') {
        items.push({
          label: player.localize('Copy magnet URI'),
          listener: function (this: videojs.Player) {
            copyToClipboard(this.webtorrent().getCurrentVideoFile().magnetUri)
          }
        })
      }

      items.push({
        icon: 'info',
        label: player.localize('Stats for nerds'),
        listener: () => {
          player.stats().show()
        }
      })

      return items.map(i => ({
        ...i,
        label: `<span class="vjs-icon-${i.icon || 'link-2'}"></span>` + i.label
      }))
    }

    return { content }
  }
}
