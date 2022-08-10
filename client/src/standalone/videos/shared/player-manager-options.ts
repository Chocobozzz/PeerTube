import {
  HTMLServerConfig,
  LiveVideo,
  VideoDetails,
  VideoStreamingPlaylistType
} from '../../../../../shared/models'
import { P2PMediaLoaderOptions, PeertubePlayerManagerOptions, PlayerMode, VideoJSCaption } from '../../../assets/player'
import {
  getParamString,
  getParamToggle,
  isP2PEnabled,
  getString,
  getToggle,
  logger,
} from '../../../root-helpers'
//import { PeerTubePlugin } from './peertube-plugin'
import { PlayerHTML } from './player-html'
import { PlaylistTracker } from './playlist-tracker'
import { Translations } from './translations'
import { VideoFetcher } from './video-fetcher'


export class PlayerManagerOptions {
  private autoplay: boolean

  private controls: boolean
  private controlBar: boolean

  private muted: boolean
  private loop: boolean
  private subtitle: string
  private enableApi = false
  private startTime: number | string = 0
  private stopTime: number | string

  private title: boolean
  private warningTitle: boolean
  private peertubeLink: boolean
  private p2pEnabled: boolean
  private bigPlayBackgroundColor: string
  private foregroundColor: string

  private mode: PlayerMode
  private scope = 'peertube'
  private mobile = false

  private assetsStorage: any
  private segmentsStorage : any

  private localTransport : typeof fetch

  constructor (
    private readonly playerHTML: PlayerHTML,
    private readonly videoFetcher: VideoFetcher,
    //private readonly peertubePlugin: PeerTubePlugin
  ) {}

  hasAPIEnabled () {
    return this.enableApi
  }

  hasAutoplay () {
    return this.autoplay
  }

  hasControls () {
    return this.controls
  }

  hasTitle () {
    return this.title
  }

  hasWarningTitle () {
    return this.warningTitle
  }

  hasP2PEnabled () {
    return !!this.p2pEnabled
  }

  hasBigPlayBackgroundColor () {
    return !!this.bigPlayBackgroundColor
  }

  getBigPlayBackgroundColor () {
    return this.bigPlayBackgroundColor
  }

  hasForegroundColor () {
    return !!this.foregroundColor
  }

  getForegroundColor () {
    return this.foregroundColor
  }

  getMode () {
    return this.mode
  }

  getScope () {
    return this.scope
  }

  // ---------------------------------------------------------------------------

  loadParams (video: VideoDetails, params : any) {
    try {
      //const params = new URL(window.location.toString()).searchParams

      this.autoplay = getToggle(params, 'autoplay', false)

      this.controls = getToggle(params, 'controls', true)
      this.controlBar = getToggle(params, 'controlBar', true)

      this.muted = getToggle(params, 'muted', undefined)
      this.loop = getToggle(params, 'loop', false)
      this.title = getToggle(params, 'title', true)
      this.enableApi = getToggle(params, 'api', this.enableApi)
      this.warningTitle = getToggle(params, 'warningTitle', true)
      this.peertubeLink = getToggle(params, 'peertubeLink', true)
      this.mobile  = getToggle(params, 'mobile', false) 

      this.p2pEnabled = getToggle(params, 'p2p', true) //getToggle(params, 'p2p', this.isP2PEnabled(config, video))

      this.scope = getString(params, 'scope', this.scope)
      this.subtitle = getString(params, 'subtitle')
      this.startTime = getString(params, 'start')
      this.stopTime = getString(params, 'stop')

      this.assetsStorage = params.assetsStorage
      this.segmentsStorage = params.segmentsStorage
      this.localTransport = params.localTransport
      //this.localVideo = getString(params, 'localvideo', false)

      /*this.bigPlayBackgroundColor = getString(params, 'bigPlayBackgroundColor')
      this.foregroundColor = getString(params, 'foregroundColor')*/

      //const modeParam = getString(params, 'mode')

      this.mode = 'p2p-media-loader'

      if(params.localVideo) this.mode = 'localvideo'

      console.log("LOCALVIDEO", this)

      /*if (modeParam) {
        if (modeParam === 'p2p-media-loader') this.mode = 'p2p-media-loader'
        else this.mode = 'webtorrent'
      } else {
        if (Array.isArray(video.streamingPlaylists) && video.streamingPlaylists.length !== 0) this.mode = 'p2p-media-loader'
        else this.mode = 'webtorrent'
      }*/

    } catch (err) {
      logger.error('Cannot get params from URL.', err)
    }
  }

  // ---------------------------------------------------------------------------

  async getPlayerOptions (options: {
    video: VideoDetails
    //captionsResponse: Response
    live?: LiveVideo

    serverConfig: HTMLServerConfig

    alreadyHadPlayer: boolean

    //translations: Translations

    /*playlistTracker?: PlaylistTracker
    playNextPlaylistVideo?: () => any
    playPreviousPlaylistVideo?: () => any*/
    onVideoUpdate?: (uuid: string, host : string) => any,

    poster ?: string,
    sources? : Array<any> | null

  }) {
    const {
      video,
      alreadyHadPlayer,
      //playlistTracker,
      live,
      serverConfig,
      sources,
      poster
    } = options

    //const videoCaptions = await this.buildCaptions(captionsResponse, translations)

    const playerOptions: PeertubePlayerManagerOptions = {
      common: {
        // Autoplay in playlist mode
        autoplay: alreadyHadPlayer ? true : this.autoplay,

        controls: this.controls,
        controlBar: this.controlBar,

        muted: this.muted,
        loop: this.loop,

        p2pEnabled: this.p2pEnabled,

        //captions: videoCaptions.length !== 0,
        subtitle: this.subtitle,

        startTime: this.startTime,
        stopTime: this.stopTime,

        //videoCaptions,
        inactivityTimeout: 2500,
        videoViewUrl: this.videoFetcher.getVideoViewsUrl(video.uuid, video.host),

        videoShortUUID: video.shortUUID,
        videoUUID: video.uuid,

        playerElement: this.playerHTML.getPlayerElement(),
        onPlayerElementChange: (element: HTMLVideoElement) => {
          this.playerHTML.setPlayerElement(element)
        },

        videoDuration: video.duration,
        enableHotkeys: false,

        peertubeLink: this.peertubeLink,
        //instanceName: serverConfig.instance.name,

        poster: poster ? poster : video.host + video.previewPath,
        theaterButton: false,

        serverUrl: video.host,
        language: navigator.language,
        embedUrl: video.host + video.embedPath,
        embedTitle: video.name,

        sources : sources,

        localTransport : this.localTransport,

        errorNotifier: () => {
          // Empty, we don't have a notifier in the embed
        },

        ...this.buildLiveOptions(video, live),

        //...this.buildPlaylistOptions(options)
      },

      webtorrent: {
        videoFiles: video.files
      },
      mobile : this.mobile,
      ...this.buildP2PMediaLoaderOptions(video),

      assetsStorage : this.assetsStorage,
      segmentsStorage : this.segmentsStorage

      //pluginsManager: this.peertubePlugin.getPluginsManager()
    }

    return playerOptions
  }

  private buildLiveOptions (video: VideoDetails, live: LiveVideo) {
    if (!video.isLive) return { isLive: false }

    return {
      isLive: true,
      liveOptions: {
        latencyMode: live.latencyMode
      }
    }
  }

  private buildP2PMediaLoaderOptions (video: VideoDetails) {
    if (this.mode !== 'p2p-media-loader') return {}

    const hlsPlaylist = video.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)

    return {
      p2pMediaLoader: {
        playlistUrl: hlsPlaylist.playlistUrl,
        segmentsSha256Url: hlsPlaylist.segmentsSha256Url,
        redundancyBaseUrls: hlsPlaylist.redundancies.map(r => r.baseUrl),
        trackerAnnounce: video.trackerUrls,
        videoFiles: hlsPlaylist.files
      } as P2PMediaLoaderOptions
    }
  }

}
