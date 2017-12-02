import { Component, Input, ViewChild } from '@angular/core'

import { ModalDirective } from 'ngx-bootstrap/modal'

import { VideoDetails } from '../shared'

@Component({
  selector: 'my-video-share',
  templateUrl: './video-share.component.html',
  styleUrls: [ './video-share.component.scss' ]
})
export class VideoShareComponent {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: ModalDirective

  copied: boolean

  constructor () {
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
    this.copied = true
    setTimeout(() => {
      this.copied = false
    }, 4000)
  }
}
