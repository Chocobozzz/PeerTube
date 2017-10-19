import { Component, Input, ViewChild } from '@angular/core'

import { ModalDirective } from 'ngx-bootstrap/modal'

import { Video } from '../shared'

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styles: [ '.resolution-block { margin-top: 20px; }' ]
})
export class VideoDownloadComponent {
  @Input() video: Video = null

  @ViewChild('modal') modal: ModalDirective

  constructor () {
    // empty
  }

  show () {
    this.modal.show()
  }

  hide () {
    this.modal.hide()
  }
}
