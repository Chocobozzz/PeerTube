import { Component } from '@angular/core';

import { NotificationsService } from 'angular2-notifications';

import { Utils, VideoAbuseService, VideoAbuse } from '../../../shared';

@Component({
	selector: 'my-video-abuse-list',
	templateUrl: './video-abuse-list.component.html'
})
export class VideoAbuseListComponent {
  videoAbusesSource = null;
  tableSettings = {
    mode: 'external',
    attr: {
      class: 'table-hover'
    },
    hideSubHeader: true,
    actions: {
      position: 'right',
      add: false,
      edit: false,
      delete: false
    },
    pager: {
      display: true,
      perPage: 10
    },
    columns: {
      id: {
        title: 'ID',
        sortDirection: 'asc'
      },
      reason: {
        title: 'Reason',
        sort: false
      },
      reporterPodHost: {
        title: 'Reporter pod host',
        sort: false
      },
      reporterUsername: {
        title: 'Reporter username',
        sort: false
      },
      videoId: {
        title: 'Video',
        type: 'html',
        sort: false,
        valuePrepareFunction: this.buildVideoLink
      },
      createdAt: {
        title: 'Created Date',
        valuePrepareFunction: Utils.dateToHuman
      }
    }
  };

  constructor(
    private notificationsService: NotificationsService,
    private videoAbuseService: VideoAbuseService
  ) {
    this.videoAbusesSource = this.videoAbuseService.getDataSource();
   }

  buildVideoLink(videoId: string) {
    // TODO: transform to routerLink
    // https://github.com/akveo/ng2-smart-table/issues/57
    return `<a href="/videos/${videoId}" title="Go to the video">${videoId}</a>`;
  }
}
