import { Component, OnInit } from '@angular/core'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import { Notifier } from '@app/core'
import { SortMeta } from 'primeng/api'
import { Job } from '../../../../../../shared/index'
import { JobState } from '../../../../../../shared/models'
import { RestPagination, RestTable } from '../../../shared'
import { JobService } from './job.service'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: [ './jobs.component.scss' ]
})
export class JobsComponent extends RestTable implements OnInit {
  private static JOB_STATE_LOCAL_STORAGE_STATE = 'jobs-list-state'

  jobState: JobState = 'waiting'
  jobStates: JobState[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed' ]
  jobs: Job[] = []
  totalRecords: number
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notifier: Notifier,
    private jobsService: JobService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.loadJobState()
    this.initialize()
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

        err => this.notifier.error(err.message)
      )
  }

  private loadJobState () {
    const result = peertubeLocalStorage.getItem(JobsComponent.JOB_STATE_LOCAL_STORAGE_STATE)

    if (result) this.jobState = result as JobState
  }

  private saveJobState () {
    peertubeLocalStorage.setItem(JobsComponent.JOB_STATE_LOCAL_STORAGE_STATE, this.jobState)
  }
}
