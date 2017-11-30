import { Component } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/primeng'
import { Job } from '../../../../../../shared/index'
import { RestPagination, RestTable } from '../../../shared'
import { JobService } from '../shared'
import { RestExtractor } from '../../../shared/rest/rest-extractor.service'

@Component({
  selector: 'my-jobs-list',
  templateUrl: './jobs-list.component.html',
  styleUrls: [ ]
})
export class JobsListComponent extends RestTable {
  jobs: Job[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private restExtractor: RestExtractor,
    private jobsService: JobService
  ) {
    super()
  }

  protected loadData () {
    this.jobsService
      .getJobs(this.pagination, this.sort)
      .map(res => this.restExtractor.applyToResultListData(res, this.formatJob.bind(this)))
      .subscribe(
        resultList => {
          this.jobs = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  private formatJob (job: Job) {
    const handlerInputData = JSON.stringify(job.handlerInputData)

    return Object.assign(job, {
      handlerInputData
    })
  }
}
