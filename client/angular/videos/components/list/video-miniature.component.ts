import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ROUTER_DIRECTIVES } from '@angular/router-deprecated';

import { Video } from '../../video';
import { VideosService } from '../../videos.service';
import { User } from '../../../users/models/user';

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ 'app/angular/videos/components/list/video-miniature.component.css' ],
  templateUrl: 'app/angular/videos/components/list/video-miniature.component.html',
  directives: [ ROUTER_DIRECTIVES ],
  pipes: [ DatePipe ]
})

export class VideoMiniatureComponent {
  @Output() removed = new EventEmitter<any>();

  @Input() video: Video;
  @Input() user: User;

  hovering: boolean = false;

  constructor(private _videosService: VideosService) {}

  onHover() {
    this.hovering = true;
  }

  onBlur() {
    this.hovering = false;
  }

  displayRemoveIcon(): boolean {
    return this.hovering && this.video.isRemovableBy(this.user);
  }

  removeVideo(id: string) {
    if (confirm('Do you really want to remove this video?')) {
      this._videosService.removeVideo(id).subscribe(
        status => this.removed.emit(true),
        error => alert(error)
      );
    }
  }
}
