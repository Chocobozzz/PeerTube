import { Component } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'

import { ConfirmService } from '../../../core'
import { Blacklist, Utils } from '../../../shared'
import { BlacklistService } from '../shared'

@Component({
  selector: 'my-blacklist-list',
  templateUrl: './blacklist-list.component.html',
  styleUrls: [ './blacklist-list.component.scss' ]
})
export class BlacklistListComponent {
  blacklistSource = null
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
      name: {
	title: 'Name'
      },
      description: {
	title: 'Description'
      },
      duration: {
	title: 'Duration'
      },
      views: {
	title: 'Views'
      },
      likes: {
	title: 'Likes'
      },
      dislikes: {
	title: 'Dislikes'
      },
      nsfw: {
	title: 'NSFW'
      },
      remoteId: {
	title: 'Remote ID'
      },
      createdAt: {
	title: 'Created Date',
	valuePrepareFunction: Utils.dateToHuman
      }
    }
  }

  constructor(
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private blacklistService: BlacklistService
  ) {
    this.blacklistSource = this.blacklistService.getDataSource()
  }

  removeVideoFromBlacklist({ data }) {
    const blacklistedVideo: Blacklist = data

    this.confirmService.confirm('Do you really want to remove this video from the blacklist ? It will be available again in the video list', 'Remove').subscribe(
      res => {
	if (res === false) return

	this.blacklistService.removeVideoFromBlacklist(blacklistedVideo).subscribe(
	  () => {
	    this.notificationsService.success('Success', `Video ${blacklistedVideo.name} removed from the blacklist.`)
	    this.blacklistSource.refresh()
	  },

	  err => this.notificationsService.error('Error', err.text)
	)
      }
    )
  }
}
