import { Component, Input, ViewChild } from '@angular/core';

import { ModalDirective } from 'ngx-bootstrap/modal';

import { Video } from '../shared';

@Component({
  selector: 'my-video-magnet',
  templateUrl: './video-magnet.component.html'
})
export class VideoMagnetComponent {
  @Input() video: Video = null;

  @ViewChild('modal') modal: ModalDirective;

  constructor() {
    // empty
  }

  show() {
    this.modal.show();
  }

  hide() {
    this.modal.hide();
  }
}
