import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { ServerService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main'
import { VideoPlaylist } from '@app/shared/shared-video-playlist'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { buildPlaylistLink, buildVideoLink, decoratePlaylistLink, decorateVideoLink } from '@shared/core-utils'
import { VideoCaption, VideoPlaylistPrivacy, VideoPrivacy } from '@shared/models'
import { buildVideoOrPlaylistEmbed } from '../../../assets/player/utils'

type Customizations = {
  startAtCheckbox: boolean
  startAt: number

  stopAtCheckbox: boolean
  stopAt: number

  subtitleCheckbox: boolean
  subtitle: string

  loop: boolean
  originUrl: boolean
  autoplay: boolean
  muted: boolean

  embedP2P: boolean
  title: boolean
  warningTitle: boolean
  controls: boolean
  peertubeLink: boolean
}

type TabId = 'url' | 'qrcode' | 'embed'

@Component({
  selector: 'my-video-share',
  templateUrl: './video-share.component.html',
  styleUrls: [ './video-share.component.scss' ]
})
export class VideoShareComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  @Input() video: VideoDetails = null
  @Input() videoCaptions: VideoCaption[] = []
  @Input() playlist: VideoPlaylist = null
  @Input() playlistPosition: number = null

  activeVideoId: TabId = 'url'
  activePlaylistId: TabId = 'url'

  customizations: Customizations
  isAdvancedCustomizationCollapsed = true
  includeVideoInPlaylist = false

  playlistEmbedHTML: SafeHtml
  videoEmbedHTML: SafeHtml

  constructor (
    private modalService: NgbModal,
    private sanitizer: DomSanitizer,
    private server: ServerService
  ) { }

  show (currentVideoTimestamp?: number, currentPlaylistPosition?: number) {
    let subtitle: string
    if (this.videoCaptions && this.videoCaptions.length !== 0) {
      subtitle = this.videoCaptions[0].language.id
    }

    this.customizations = new Proxy({
      startAtCheckbox: false,
      startAt: currentVideoTimestamp ? Math.floor(currentVideoTimestamp) : 0,

      stopAtCheckbox: false,
      stopAt: this.video?.duration,

      subtitleCheckbox: false,
      subtitle,

      loop: false,
      originUrl: false,
      autoplay: false,
      muted: false,

      embedP2P: this.server.getHTMLConfig().defaults.p2p.embed.enabled,

      // Embed options
      title: true,
      warningTitle: true,
      controls: true,
      peertubeLink: true
    }, {
      set: (target, prop, value) => {
        target[prop] = value

        if (prop === 'embedP2P') {
          // Auto enabled warning title if P2P is enabled
          this.customizations.warningTitle = value
        }

        this.updateEmbedCode()

        return true
      }
    })

    this.playlistPosition = currentPlaylistPosition

    this.updateEmbedCode()

    this.modalService.open(this.modal, { centered: true })
  }

  getVideoIframeCode () {
    const embedUrl = decorateVideoLink({ url: this.video.embedUrl, ...this.getVideoOptions(true) })

    return buildVideoOrPlaylistEmbed(embedUrl, this.video.name)
  }

  getPlaylistIframeCode () {
    const embedUrl = decoratePlaylistLink({ url: this.playlist.embedUrl, ...this.getPlaylistOptions() })

    return buildVideoOrPlaylistEmbed(embedUrl, this.playlist.displayName)
  }

  getVideoUrl () {
    const url = this.customizations.originUrl
      ? this.video.url
      : buildVideoLink(this.video, window.location.origin)

    return decorateVideoLink({
      url,

      ...this.getVideoOptions(false)
    })
  }

  getPlaylistUrl () {
    const url = buildPlaylistLink(this.playlist)
    if (!this.includeVideoInPlaylist) return url

    return decoratePlaylistLink({ url, playlistPosition: this.playlistPosition })
  }

  updateEmbedCode () {
    if (this.playlist) this.playlistEmbedHTML = this.sanitizer.bypassSecurityTrustHtml(this.getPlaylistIframeCode())

    if (this.video) this.videoEmbedHTML = this.sanitizer.bypassSecurityTrustHtml(this.getVideoIframeCode())
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  isVideoInEmbedTab () {
    return this.activeVideoId === 'embed'
  }

  isLocalVideo () {
    return this.video.isLocal
  }

  isPrivateVideo () {
    return this.video.privacy.id === VideoPrivacy.PRIVATE
  }

  isPrivatePlaylist () {
    return this.playlist.privacy.id === VideoPlaylistPrivacy.PRIVATE
  }

  private getPlaylistOptions (baseUrl?: string) {
    return {
      baseUrl,

      playlistPosition: this.playlistPosition || undefined
    }
  }

  private getVideoOptions (forEmbed: boolean) {
    const embedOptions = forEmbed
      ? {
        title: this.customizations.title,
        warningTitle: this.customizations.warningTitle,
        controls: this.customizations.controls,
        peertubeLink: this.customizations.peertubeLink,

        // If using default value, we don't need to specify it
        p2p: this.customizations.embedP2P === this.server.getHTMLConfig().defaults.p2p.embed.enabled
          ? undefined
          : this.customizations.embedP2P
      }
      : {}

    return {
      startTime: this.customizations.startAtCheckbox ? this.customizations.startAt : undefined,
      stopTime: this.customizations.stopAtCheckbox ? this.customizations.stopAt : undefined,

      subtitle: this.customizations.subtitleCheckbox ? this.customizations.subtitle : undefined,

      loop: this.customizations.loop,
      autoplay: this.customizations.autoplay,
      muted: this.customizations.muted,

      ...embedOptions
    }
  }
}
