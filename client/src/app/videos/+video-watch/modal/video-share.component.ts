import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { buildVideoEmbed } from '../../../../assets/player/utils'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-video-share',
  templateUrl: './video-share.component.html',
  styleUrls: [ './video-share.component.scss' ]
})
export class VideoShareComponent {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: ElementRef

  constructor (
    private modalService: NgbModal,
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) {
    // empty
  }

  show () {
    this.modalService.open(this.modal)
  }

  getVideoIframeCode () {
    return buildVideoEmbed(this.video.embedUrl)
  }

  getVideoUrl () {
    return window.location.href
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  activateCopiedMessage () {
    this.notificationsService.success(this.i18n('Success'), this.i18n('Copied'))
  }
}
