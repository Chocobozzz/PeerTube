import { Component, OnInit } from '@angular/core'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/primeng'
import { Job } from '../../../../../../shared/index'
import { JobState } from '../../../../../../shared/models'
import { RestPagination, RestTable } from '../../../shared'
import { RestExtractor } from '../../../shared/rest/rest-extractor.service'
import { JobService } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-jobs-list',
  templateUrl: './jobs-list.component.html',
  styleUrls: [ './jobs-list.component.scss' ]
})
export class JobsListComponent extends RestTable implements OnInit {
  private static JOB_STATE_LOCAL_STORAGE_STATE = 'jobs-list-state'

  jobState: JobState = 'waiting'
  jobStates: JobState[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed' ]
  jobs: Job[] = []
  totalRecords: number
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private restExtractor: RestExtractor,
    private jobsService: JobService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.loadJobState()
    this.loadSort()
  }

  onJobStateChanged () {
    this.pagination.start = 0

    this.loadData()
    this.saveJobState()
  }

  protected loadData () {
    this.jobsService
      .getJobs(this.jobState, this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.jobs = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  private loadJobState () {
    const result = peertubeLocalStorage.getItem(JobsListComponent.JOB_STATE_LOCAL_STORAGE_STATE)

    if (result) this.jobState = result as JobState
  }

  private saveJobState () {
    peertubeLocalStorage.setItem(JobsListComponent.JOB_STATE_LOCAL_STORAGE_STATE, this.jobState)
  }
}
