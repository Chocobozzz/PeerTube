import { Component, Input, Output, EventEmitter } from '@angular/core';

import { NotificationsService } from 'angular2-notifications';

import { ConfirmService, ConfigService } from '../../core';
import { SortField, Video, VideoService } from '../shared';
import { User } from '../../shared';

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html'
})

export class VideoMiniatureComponent {
  @Input() currentSort: SortField;
  @Input() user: User;
  @Input() video: Video;

  hovering = false;

  constructor(
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private configService: ConfigService,
    private videoService: VideoService
  ) {}

  getVideoName() {
    if (this.isVideoNSFWForThisUser())
      return 'NSFW';

    return this.video.name;
  }

  onBlur() {
    this.hovering = false;
  }

  onHover() {
    this.hovering = true;
  }

  isVideoNSFWForThisUser() {
    return this.video.isVideoNSFWForUser(this.user);
  }
}
