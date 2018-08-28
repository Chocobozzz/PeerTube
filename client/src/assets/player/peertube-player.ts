import { VideoFile } from '../../../../shared/models/videos'

import 'videojs-hotkeys'
import 'videojs-dock'
import 'videojs-contextmenu'
import 'videojs-contextmenu-ui'
import './peertube-link-button'
import './resolution-menu-button'
import './settings-menu-button'
import './webtorrent-info-button'
import './peertube-videojs-plugin'
import './peertube-load-progress-bar'
import './theater-button'
import { VideoJSCaption, videojsUntyped } from './peertube-videojs-typings'
import { buildVideoEmbed, buildVideoLink, copyToClipboard } from './utils'
import { getCompleteLocale, getShortLocale, is18nLocale, isDefaultLocale } from '../../../../shared/models/i18n/i18n'

// Change 'Playback Rate' to 'Speed' (smaller for our settings menu)
videojsUntyped.getComponent('PlaybackRateMenuButton').prototype.controlText_ = 'Speed'
// Change Captions to Subtitles/CC
videojsUntyped.getComponent('CaptionsButton').prototype.controlText_ = 'Subtitles/CC'
// We just want to display 'Off' instead of 'captions off', keep a space so the variable == true (hacky I know)
videojsUntyped.getComponent('CaptionsButton').prototype.label_ = ' '

function getVideojsOptions (options: {
  autoplay: boolean,
  playerElement: HTMLVideoElement,
  videoViewUrl: string,
  videoDuration: number,
  videoFiles: VideoFile[],
  enableHotkeys: boolean,
  inactivityTimeout: number,
  peertubeLink: boolean,
  poster: string,
  startTime: number | string
  theaterMode: boolean,
  videoCaptions: VideoJSCaption[],
  language?: string,
  controls?: boolean,
  muted?: boolean,
  loop?: boolean
}) {
  const videojsOptions = {
    // We don't use text track settings for now
    textTrackSettings: false,
    controls: options.controls !== undefined ? options.controls : true,
    muted: options.controls !== undefined ? options.muted : false,
    loop: options.loop !== undefined ? options.loop : false,
    poster: options.poster,
    autoplay: false,
    inactivityTimeout: options.inactivityTimeout,
    playbackRates: [ 0.5, 1, 1.5, 2 ],
    plugins: {
      peertube: {
        autoplay: options.autoplay, // Use peertube plugin autoplay because we get the file by webtorrent
        videoCaptions: options.videoCaptions,
        videoFiles: options.videoFiles,
        playerElement: options.playerElement,
        videoViewUrl: options.videoViewUrl,
        videoDuration: options.videoDuration,
        startTime: options.startTime
      }
    },
    controlBar: {
      children: getControlBarChildren(options)
    }
  }

  if (options.enableHotkeys === true) {
    Object.assign(videojsOptions.plugins, {
      hotkeys: {
        enableVolumeScroll: false,
        enableModifiersForNumbers: false
      }
    })
  }

  if (options.language && !isDefaultLocale(options.language)) {
    Object.assign(videojsOptions, { language: options.language })
  }

  return videojsOptions
}

function getControlBarChildren (options: {
  peertubeLink: boolean
  theaterMode: boolean,
  videoCaptions: VideoJSCaption[]
}) {
  const settingEntries = []

  // Keep an order
  settingEntries.push('playbackRateMenuButton')
  if (options.videoCaptions.length !== 0) settingEntries.push('captionsButton')
  settingEntries.push('resolutionMenuButton')

  const children = {
    'playToggle': {},
    'currentTimeDisplay': {},
    'timeDivider': {},
    'durationDisplay': {},
    'liveDisplay': {},

    'flexibleWidthSpacer': {},
    'progressControl': {
      children: {
        'seekBar': {
          children: {
            'peerTubeLoadProgressBar': {},
            'mouseTimeDisplay': {},
            'playProgressBar': {}
          }
        }
      }
    },

    'webTorrentButton': {},

    'muteToggle': {},
    'volumeControl': {},

    'settingsButton': {
      setup: {
        maxHeightOffset: 40
      },
      entries: settingEntries
    }
  }

  if (options.peertubeLink === true) {
    Object.assign(children, {
      'peerTubeLinkButton': {}
    })
  }

  if (options.theaterMode === true) {
    Object.assign(children, {
      'theaterButton': {}
    })
  }

  Object.assign(children, {
    'fullscreenToggle': {}
  })

  return children
}

function addContextMenu (player: any, videoEmbedUrl: string) {
  player.contextmenuUI({
    content: [
      {
        label: player.localize('Copy the video URL'),
        listener: function () {
          copyToClipboard(buildVideoLink())
        }
      },
      {
        label: player.localize('Copy the video URL at the current time'),
        listener: function () {
          const player = this
          copyToClipboard(buildVideoLink(player.currentTime()))
        }
      },
      {
        label: player.localize('Copy embed code'),
        listener: () => {
          copyToClipboard(buildVideoEmbed(videoEmbedUrl))
        }
      },
      {
        label: player.localize('Copy magnet URI'),
        listener: function () {
          const player = this
          copyToClipboard(player.peertube().getCurrentVideoFile().magnetUri)
        }
      }
    ]
  })
}

function loadLocaleInVideoJS (serverUrl: string, videojs: any, locale: string) {
  const path = getLocalePath(serverUrl, locale)
  // It is the default locale, nothing to translate
  if (!path) return Promise.resolve(undefined)

  let p: Promise<any>

  if (loadLocaleInVideoJS.cache[path]) {
    p = Promise.resolve(loadLocaleInVideoJS.cache[path])
  } else {
    p = fetch(path + '/player.json')
      .then(res => res.json())
      .then(json => {
        loadLocaleInVideoJS.cache[path] = json
        return json
      })
  }

  const completeLocale = getCompleteLocale(locale)
  return p.then(json => videojs.addLanguage(getShortLocale(completeLocale), json))
}
namespace loadLocaleInVideoJS {
  export const cache: { [ path: string ]: any } = {}
}

function getServerTranslations (serverUrl: string, locale: string) {
  const path = getLocalePath(serverUrl, locale)
  // It is the default locale, nothing to translate
  if (!path) return Promise.resolve(undefined)

  return fetch(path + '/server.json')
    .then(res => res.json())
}

// ############################################################################

export {
  getServerTranslations,
  loadLocaleInVideoJS,
  getVideojsOptions,
  addContextMenu
}

// ############################################################################

function getLocalePath (serverUrl: string, locale: string) {
  const completeLocale = getCompleteLocale(locale)

  if (!is18nLocale(completeLocale) || isDefaultLocale(completeLocale)) return undefined

  return serverUrl + '/client/locales/' + completeLocale
}
