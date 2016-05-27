import { DatePipe } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router-deprecated';

import { Video, VideoService } from '../shared/index';
import { User } from '../../users/index';

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ 'client/app/videos/video-list/video-miniature.component.css' ],
  templateUrl: 'client/app/videos/video-list/video-miniature.component.html',
  directives: [ ROUTER_DIRECTIVES ],
  pipes: [ DatePipe ]
})

export class VideoMiniatureComponent {
  @Output() removed = new EventEmitter<any>();

  @Input() user: User;
  @Input() video: Video;

  hovering = false;

  constructor(private videoService: VideoService) {}

  displayRemoveIcon() {
    return this.hovering && this.video.isRemovableBy(this.user);
  }

  onBlur() {
    this.hovering = false;
  }

  onHover() {
    this.hovering = true;
  }

  removeVideo(id: string) {
    if (confirm('Do you really want to remove this video?')) {
      this.videoService.removeVideo(id).subscribe(
        status => this.removed.emit(true),
        error => alert(error)
      );
    }
  }
}
