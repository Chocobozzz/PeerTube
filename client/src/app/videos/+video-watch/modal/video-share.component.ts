import { Component, Input, ViewChild } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'

import { ModalDirective } from 'ngx-bootstrap/modal'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { buildVideoEmbed } from '../../../../assets/player/utils'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-video-share',
  templateUrl: './video-share.component.html',
  styleUrls: [ './video-share.component.scss' ]
})
export class VideoShareComponent {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: ModalDirective

  constructor (
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) {
    // empty
  }

  show () {
    this.modal.show()
  }

  hide () {
    this.modal.hide()
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
