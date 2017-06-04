import { Component } from '@angular/core';

import { NotificationsService } from 'angular2-notifications';

import { ConfirmService } from '../../../core';
import { Blacklist, Utils } from '../../../shared';
import { BlacklistService } from '../shared';

@Component({
  selector: 'my-blacklist-list',
  templateUrl: './blacklist-list.component.html',
  styleUrls: [ './blacklist-list.component.scss' ]
})
export class BlacklistListComponent {
  blacklistSource = null;
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
      delete: true
    },
    delete: {
      deleteButtonContent: Utils.getRowDeleteButton()
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
      videoId: {
	title: 'Video ID'
      },
      createdAt: {
	title: 'Created Date',
	valuePrepareFunction: Utils.dateToHuman
      }
    }
  };

  constructor(
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private blacklistService: BlacklistService
  ) {
    this.blacklistSource = this.blacklistService.getDataSource();
  }

  removeVideoFromBlacklist({ data }) {
    const blacklistedVideo: Blacklist = data;

    this.confirmService.confirm('Do you really want to remove this video from the blacklist ?', 'Remove').subscribe(
      res => {
	if (res === false) return;

	console.log("OK !");
	return;
      }
    );
  }
}
