import { Component, OnInit } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'

import { ConfirmService } from '../../../core'
import { BlacklistService } from '../shared'
import { BlacklistedVideo } from '../../../../../../shared'

@Component({
  selector: 'my-blacklist-list',
  templateUrl: './blacklist-list.component.html',
  styleUrls: []
})
export class BlacklistListComponent implements OnInit {
  blacklist: BlacklistedVideo[] = []

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private blacklistService: BlacklistService
  ) {}

  ngOnInit () {
    this.loadData()
  }

  removeVideoFromBlacklist (entry: BlacklistedVideo) {
    const confirmMessage = 'Do you really want to remove this video from the blacklist ? It will be available again in the video list.'

    this.confirmService.confirm(confirmMessage, 'Remove').subscribe(
      res => {
        if (res === false) return

        this.blacklistService.removeVideoFromBlacklist(entry).subscribe(
          status => {
            this.notificationsService.success('Success', `Video ${entry.name} removed from the blacklist.`)
            this.loadData()
          },

          err => this.notificationsService.error('Error', err.message)
        )
      }
    )
  }

  private loadData () {
    this.blacklistService.getBlacklist()
                         .subscribe(
	                   resultList => {
                             this.blacklist = resultList.data
                           },

                           err => this.notificationsService.error('Error', err.message)
                         )
  }
}
