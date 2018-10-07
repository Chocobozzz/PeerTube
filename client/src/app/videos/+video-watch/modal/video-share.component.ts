import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
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

  startAtCheckbox = false
  currentVideoTimestampString: string

  private currentVideoTimestamp: number

  constructor (
    private modalService: NgbModal,
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) { }

  show (currentVideoTimestamp?: number) {
    this.currentVideoTimestamp = Math.floor(currentVideoTimestamp)
    this.currentVideoTimestampString = durationToString(this.currentVideoTimestamp)

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
    this.notificationsService.success(this.i18n('Success'), this.i18n('Copied'))
  }

  getStartCheckboxLabel () {
    return this.i18n('Start at {{timestamp}}', { timestamp: this.currentVideoTimestampString })
  }

  private getVideoTimestampIfEnabled () {
    if (this.startAtCheckbox === true) return this.currentVideoTimestamp

    return undefined
  }
}
