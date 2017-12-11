import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/primeng'
import { Job } from '../../../../../../shared/index'
import { RestPagination, RestTable } from '../../../shared'
import { viewportHeight } from '../../../shared/misc/utils'
import { JobService } from '../shared'
import { RestExtractor } from '../../../shared/rest/rest-extractor.service'

@Component({
  selector: 'my-jobs-list',
  templateUrl: './jobs-list.component.html',
  styleUrls: [ './jobs-list.component.scss' ]
})
export class JobsListComponent extends RestTable implements OnInit {
  jobs: Job[] = []
  totalRecords = 0
  rowsPerPage = 20
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }
  scrollHeight = ''

  constructor (
    private notificationsService: NotificationsService,
    private restExtractor: RestExtractor,
    private jobsService: JobService
  ) {
    super()
  }

  ngOnInit () {
    // 270 -> headers + footer...
    this.scrollHeight = (viewportHeight() - 380) + 'px'
  }

  protected loadData () {
    this.jobsService
      .getJobs(this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.jobs = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }
}
