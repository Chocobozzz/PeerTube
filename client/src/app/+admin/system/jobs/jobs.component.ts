import { Component, OnInit } from '@angular/core'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-web-storage'
import { Notifier } from '@app/core'
import { SortMeta } from 'primeng/api'
import { Job, JobType } from '../../../../../../shared/index'
import { JobState } from '../../../../../../shared/models'
import { RestPagination, RestTable } from '../../../shared'
import { JobService } from './job.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { JobStateClient } from '../../../../types/job-state-client.type'
import { JobTypeClient } from '../../../../types/job-type-client.type'

@Component({
  selector: 'my-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: [ './jobs.component.scss' ]
})
export class JobsComponent extends RestTable implements OnInit {
  private static LOCAL_STORAGE_STATE = 'jobs-list-state'
  private static LOCAL_STORAGE_TYPE = 'jobs-list-type'

  jobState: JobStateClient = 'waiting'
  jobStates: JobStateClient[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed' ]

  jobType: JobTypeClient = 'all'
  jobTypes: JobTypeClient[] = [
    'all',
    'activitypub-follow',
    'activitypub-http-broadcast',
    'activitypub-http-fetcher',
    'activitypub-http-unicast',
    'email',
    'video-transcoding',
    'video-file-import',
    'video-import',
    'videos-views',
    'activitypub-refresher',
    'video-redundancy'
  ]

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
    this.loadJobStateAndType()
    this.initialize()
  }

  onJobStateOrTypeChanged () {
    this.pagination.start = 0

    this.loadData()
    this.saveJobStateAndType()
  }

  protected loadData () {
    this.jobsService
      .getJobs(this.jobState, this.jobType, this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.jobs = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notifier.error(err.message)
      )
  }

  private loadJobStateAndType () {
    const state = peertubeLocalStorage.getItem(JobsComponent.LOCAL_STORAGE_STATE)
    if (state) this.jobState = state as JobState

    const type = peertubeLocalStorage.getItem(JobsComponent.LOCAL_STORAGE_TYPE)
    if (type) this.jobType = type as JobType
  }

  private saveJobStateAndType () {
    peertubeLocalStorage.setItem(JobsComponent.LOCAL_STORAGE_STATE, this.jobState)
    peertubeLocalStorage.setItem(JobsComponent.LOCAL_STORAGE_TYPE, this.jobType)
  }
}
