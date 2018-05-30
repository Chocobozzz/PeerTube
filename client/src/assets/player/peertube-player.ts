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
import { videojsUntyped } from './peertube-videojs-typings'
import { buildVideoEmbed, buildVideoLink, copyToClipboard } from './utils'

// Change 'Playback Rate' to 'Speed' (smaller for our settings menu)
videojsUntyped.getComponent('PlaybackRateMenuButton').prototype.controlText_ = 'Speed'

function getVideojsOptions (options: {
  autoplay: boolean,
  playerElement: HTMLVideoElement,
  videoViewUrl: string,
  videoEmbedUrl: string,
  videoDuration: number,
  videoFiles: VideoFile[],
  enableHotkeys: boolean,
  inactivityTimeout: number,
  peertubeLink: boolean,
  poster: string,
  startTime: number
}) {
  const videojsOptions = {
    controls: true,
    poster: options.poster,
    autoplay: false,
    inactivityTimeout: options.inactivityTimeout,
    playbackRates: [ 0.5, 1, 1.5, 2 ],
    plugins: {
      peertube: {
        autoplay: options.autoplay, // Use peertube plugin autoplay because we get the file by webtorrent
        videoFiles: options.videoFiles,
        playerElement: options.playerElement,
        videoViewUrl: options.videoViewUrl,
        videoDuration: options.videoDuration,
        startTime: options.startTime
      },
      contextmenuUI: {
        content: [
          {
            label: 'Copy the video URL',
            listener: function () {
              copyToClipboard(buildVideoLink())
            }
          },
          {
            label: 'Copy the video URL at the current time',
            listener: function () {
              const player = this
              copyToClipboard(buildVideoLink(player.currentTime()))
            }
          },
          {
            label: 'Copy embed code',
            listener: () => {
              copyToClipboard(buildVideoEmbed(options.videoEmbedUrl))
            }
          }
        ]
      }
    },
    controlBar: {
      children: getControlBarChildren(options)
    }
  }

  if (options.enableHotkeys === true) {
    Object.assign(videojsOptions.plugins, {
      hotkeys: {
        enableVolumeScroll: false
      }
    })
  }

  return videojsOptions
}

function getControlBarChildren (options: {
  peertubeLink: boolean
}) {
  const children = {
    'playToggle': {},
    'currentTimeDisplay': {},
    'timeDivider': {},
    'durationDisplay': {},
    'liveDisplay': {},

    'flexibleWidthSpacer': {},
    'progressControl': {},

    'webTorrentButton': {},

    'muteToggle': {},
    'volumeControl': {},

    'settingsButton': {
      setup: {
        maxHeightOffset: 40
      },
      entries: [
        'resolutionMenuButton',
        'playbackRateMenuButton'
      ]
    }
  }

  if (options.peertubeLink === true) {
    Object.assign(children, {
      'peerTubeLinkButton': {}
    })
  }

  Object.assign(children, {
    'fullscreenToggle': {}
  })

  return children
}

export { getVideojsOptions }
