import { Component, Input, ViewChild } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'

import { ModalDirective } from 'ngx-bootstrap/modal'
import { VideoDetails } from '../../shared/video/video-details.model'

@Component({
  selector: 'my-video-share',
  templateUrl: './video-share.component.html',
  styleUrls: [ './video-share.component.scss' ]
})
export class VideoShareComponent {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: ModalDirective

  constructor (private notificationsService: NotificationsService) {
    // empty
  }

  show () {
    this.modal.show()
  }

  hide () {
    this.modal.hide()
  }

  getVideoIframeCode () {
    return '<iframe width="560" height="315" ' +
           'src="' + this.video.embedUrl + '" ' +
           'frameborder="0" allowfullscreen>' +
           '</iframe>'
  }

  getVideoUrl () {
    return window.location.href
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  activateCopiedMessage () {
    this.notificationsService.success('Success', 'Copied')
  }
}
