import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { ConfirmService } from '../../../core'
import { RestPagination, RestTable, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { User } from '../../../../../../shared'

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ]
})
export class UserListComponent extends RestTable implements OnInit {
  users: User[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.loadSort()
  }

  onUserChanged () {
    this.loadData()
  }

  protected loadData () {
    this.userService.getUsers(this.pagination, this.sort)
                    .subscribe(
                      resultList => {
                        this.users = resultList.data
                        this.totalRecords = resultList.total
                      },

                      err => this.notificationsService.error(this.i18n('Error'), err.message)
                    )
  }
}
