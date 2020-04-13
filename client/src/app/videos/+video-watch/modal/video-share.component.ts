import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { buildVideoEmbed, buildVideoLink } from '../../../../assets/player/utils'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption } from '@shared/models'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'

type Customizations = {
  startAtCheckbox: boolean
  startAt: number

  stopAtCheckbox: boolean
  stopAt: number

  subtitleCheckbox: boolean
  subtitle: string

  loop: boolean
  autoplay: boolean
  muted: boolean
  title: boolean
  warningTitle: boolean
  controls: boolean
}

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

  activeId: 'url' | 'qrcode' | 'embed' = 'url'
  customizations: Customizations
  isAdvancedCustomizationCollapsed = true
  includeVideoInPlaylist = false

  private currentVideoTimestamp: number

  constructor (private modalService: NgbModal) { }

  show (currentVideoTimestamp?: number) {
    this.currentVideoTimestamp = currentVideoTimestamp

    let subtitle: string
    if (this.videoCaptions.length !== 0) {
      subtitle = this.videoCaptions[0].language.id
    }

    this.customizations = {
      startAtCheckbox: false,
      startAt: currentVideoTimestamp ? Math.floor(currentVideoTimestamp) : 0,

      stopAtCheckbox: false,
      stopAt: this.video.duration,

      subtitleCheckbox: false,
      subtitle,

      loop: false,
      autoplay: false,
      muted: false,

      // Embed options
      title: true,
      warningTitle: true,
      controls: true
    }

    this.modalService.open(this.modal, { centered: true })
  }

  getVideoIframeCode () {
    const options = this.getOptions(this.video.embedUrl)

    const embedUrl = buildVideoLink(options)
    return buildVideoEmbed(embedUrl)
  }

  getVideoUrl () {
    const baseUrl = window.location.origin + '/videos/watch/' + this.video.uuid
    const options = this.getOptions(baseUrl)

    return buildVideoLink(options)
  }

  getPlaylistUrl () {
    const base = window.location.origin + '/videos/watch/playlist/' + this.playlist.uuid

    if (!this.includeVideoInPlaylist) return base

    return base + '?videoId=' + this.video.uuid
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  isInEmbedTab () {
    return this.activeId === 'embed'
  }

  hasPlaylist () {
    return !!this.playlist
  }

  private getOptions (baseUrl?: string) {
    return {
      baseUrl,

      startTime: this.customizations.startAtCheckbox ? this.customizations.startAt : undefined,
      stopTime: this.customizations.stopAtCheckbox ? this.customizations.stopAt : undefined,

      subtitle: this.customizations.subtitleCheckbox ? this.customizations.subtitle : undefined,

      loop: this.customizations.loop,
      autoplay: this.customizations.autoplay,
      muted: this.customizations.muted,

      title: this.customizations.title,
      warningTitle: this.customizations.warningTitle,
      controls: this.customizations.controls
    }
  }
}
