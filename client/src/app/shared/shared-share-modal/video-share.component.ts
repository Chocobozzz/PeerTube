import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { VideoDetails } from '@app/shared/shared-main'
import { VideoPlaylist } from '@app/shared/shared-video-playlist'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { buildPlaylistLink, buildVideoLink, decoratePlaylistLink, decorateVideoLink } from '@shared/core-utils'
import { VideoCaption } from '@shared/models'
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

  constructor (private modalService: NgbModal) { }

  show (currentVideoTimestamp?: number, currentPlaylistPosition?: number) {
    let subtitle: string
    if (this.videoCaptions && this.videoCaptions.length !== 0) {
      subtitle = this.videoCaptions[0].language.id
    }

    this.customizations = {
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

      // Embed options
      title: true,
      warningTitle: true,
      controls: true,
      peertubeLink: true
    }

    this.playlistPosition = currentPlaylistPosition

    this.modalService.open(this.modal, { centered: true })
  }

  getVideoIframeCode () {
    const embedUrl = decorateVideoLink({ url: this.video.embedUrl, ...this.getVideoOptions() })

    return buildVideoOrPlaylistEmbed(embedUrl, this.video.name)
  }

  getPlaylistIframeCode () {
    const embedUrl = decoratePlaylistLink({ url: this.playlist.embedUrl, ...this.getPlaylistOptions() })

    return buildVideoOrPlaylistEmbed(embedUrl, this.playlist.displayName)
  }

  getVideoUrl () {
    const baseUrl = this.customizations.originUrl
      ? this.video.originInstanceUrl
      : window.location.origin

    return decorateVideoLink({
      url: buildVideoLink(this.video, baseUrl),

      ...this.getVideoOptions()
    })
  }

  getPlaylistUrl () {
    const url = buildPlaylistLink(this.playlist)
    if (!this.includeVideoInPlaylist) return url

    return decoratePlaylistLink({ url, playlistPosition: this.playlistPosition })
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

  private getPlaylistOptions (baseUrl?: string) {
    return {
      baseUrl,

      playlistPosition: this.playlistPosition || undefined
    }
  }

  private getVideoOptions () {
    return {
      startTime: this.customizations.startAtCheckbox ? this.customizations.startAt : undefined,
      stopTime: this.customizations.stopAtCheckbox ? this.customizations.stopAt : undefined,

      subtitle: this.customizations.subtitleCheckbox ? this.customizations.subtitle : undefined,

      loop: this.customizations.loop,
      autoplay: this.customizations.autoplay,
      muted: this.customizations.muted,

      title: this.customizations.title,
      warningTitle: this.customizations.warningTitle,
      controls: this.customizations.controls,
      peertubeLink: this.customizations.peertubeLink
    }
  }
}
