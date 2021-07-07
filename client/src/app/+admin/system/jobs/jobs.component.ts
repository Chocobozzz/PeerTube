import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { Job, JobState, JobType } from '@shared/models'
import { JobStateClient } from '../../../../types/job-state-client.type'
import { JobTypeClient } from '../../../../types/job-type-client.type'
import { JobService } from './job.service'

@Component({
  selector: 'my-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: [ './jobs.component.scss' ]
})
export class JobsComponent extends RestTable implements OnInit {
  private static LOCAL_STORAGE_STATE = 'jobs-list-state'
  private static LOCAL_STORAGE_TYPE = 'jobs-list-type'

  jobState?: JobStateClient | 'all'
  jobStates: JobStateClient[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed' ]

  jobType: JobTypeClient = 'all'
  jobTypes: JobTypeClient[] = [
    'all',

    'activitypub-follow',
    'activitypub-http-broadcast',
    'activitypub-http-fetcher',
    'activitypub-http-unicast',
    'activitypub-refresher',
    'activitypub-cleaner',
    'actor-keys',
    'email',
    'video-file-import',
    'video-import',
    'video-live-ending',
    'video-redundancy',
    'video-transcoding',
    'videos-views'
  ]

  jobs: Job[] = []
  totalRecords: number
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notifier: Notifier,
    private jobsService: JobService
  ) {
    super()
  }

  ngOnInit () {
    this.loadJobStateAndType()
    this.initialize()
  }

  getIdentifier () {
    return 'JobsComponent'
  }

  getJobStateClass (state: JobStateClient) {
    switch (state) {
      case 'active':
        return 'badge-blue'
      case 'completed':
        return 'badge-green'
      case 'delayed':
        return 'badge-brown'
      case 'failed':
        return 'badge-red'
      case 'waiting':
        return 'badge-yellow'
    }
  }

  getColspan () {
    if (this.jobState === 'all' && this.hasProgress()) return 7

    if (this.jobState === 'all' || this.hasProgress()) return 6

    return 5
  }

  onJobStateOrTypeChanged () {
    this.pagination.start = 0

    this.reloadData()
    this.saveJobStateAndType()
  }

  hasProgress () {
    return this.jobType === 'all' || this.jobType === 'video-transcoding'
  }

  getProgress (job: Job) {
    if (job.state === 'active') return job.progress + '%'

    return ''
  }

  refresh () {
    this.jobs = []
    this.totalRecords = 0

    this.reloadData()
  }

  protected reloadData () {
    let jobState = this.jobState as JobState
    if (this.jobState === 'all') jobState = null

    this.jobsService
      .getJobs({
        jobState,
        jobType: this.jobType,
        pagination: this.pagination,
        sort: this.sort
      })
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
