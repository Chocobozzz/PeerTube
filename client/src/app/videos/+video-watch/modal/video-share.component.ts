import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { buildVideoEmbed, buildVideoLink } from '../../../../assets/player/utils'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { durationToString } from '@app/shared/misc/utils'

@Component({
  selector: 'my-video-share',
  templateUrl: './video-share.component.html',
  styleUrls: [ './video-share.component.scss' ]
})
export class VideoShareComponent {
  @ViewChild('modal') modal: ElementRef

  @Input() video: VideoDetails = null

  currentVideoTimestamp: number
  startAtCheckbox = false

  constructor (
    private modalService: NgbModal,
    private notifier: Notifier,
    private i18n: I18n
  ) { }

  show (currentVideoTimestamp?: number) {
    this.currentVideoTimestamp = currentVideoTimestamp ? Math.floor(currentVideoTimestamp) : 0

    this.modalService.open(this.modal)
  }

  getVideoIframeCode () {
    const embedUrl = buildVideoLink(this.getVideoTimestampIfEnabled(), this.video.embedUrl)

    return buildVideoEmbed(embedUrl)
  }

  getVideoUrl () {
    return buildVideoLink(this.getVideoTimestampIfEnabled())
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  activateCopiedMessage () {
    this.notifier.success(this.i18n('Copied'))
  }

  private getVideoTimestampIfEnabled () {
    if (this.startAtCheckbox === true) return this.currentVideoTimestamp

    return undefined
  }
}
