import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { buildVideoEmbed, buildVideoLink } from '../../../../assets/player/utils'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NgbModal, NgbTabChangeEvent } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption } from '@shared/models'

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

  activeId: 'url' | 'qrcode' | 'embed'
  customizations: Customizations
  isAdvancedCustomizationCollapsed = true

  private currentVideoTimestamp: number

  constructor (
    private modalService: NgbModal,
    private notifier: Notifier,
    private i18n: I18n
  ) { }

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

    this.modalService.open(this.modal)
  }

  getVideoIframeCode () {
    const options = this.getOptions(this.video.embedUrl)

    const embedUrl = buildVideoLink(options)
    return buildVideoEmbed(embedUrl)
  }

  getVideoUrl () {
    const options = this.getOptions()

    return buildVideoLink(options)
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  activateCopiedMessage () {
    this.notifier.success(this.i18n('Copied'))
  }

  onTabChange (event: NgbTabChangeEvent) {
    this.activeId = event.nextId as any
  }

  isInEmbedTab () {
    return this.activeId === 'embed'
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
