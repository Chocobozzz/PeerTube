import { SortMeta, SharedModule } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { escapeHTML } from '@peertube/peertube-core-utils'
import { Job, JobState, JobType } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { JobStateClient } from '../../../../types/job-state-client.type'
import { JobTypeClient } from '../../../../types/job-type-client.type'
import { JobService } from './job.service'
import { TableExpanderIconComponent } from '../../../shared/shared-tables/table-expander-icon.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { TableModule } from 'primeng/table'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { NgSelectModule } from '@ng-select/ng-select'
import { NgFor, NgClass, NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'

@Component({
  selector: 'my-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: [ './jobs.component.scss' ],
  standalone: true,
  imports: [
    FormsModule,
    NgFor,
    NgSelectModule,
    NgClass,
    ButtonComponent,
    TableModule,
    SharedModule,
    NgIf,
    NgbTooltip,
    TableExpanderIconComponent
  ]
})
export class JobsComponent extends RestTable implements OnInit {
  private static LOCAL_STORAGE_STATE = 'jobs-list-state'
  private static LOCAL_STORAGE_TYPE = 'jobs-list-type'

  jobState?: JobStateClient | 'all'
  jobStates: JobStateClient[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed' ]

  jobType: JobTypeClient = 'all'
  jobTypes: JobTypeClient[] = [
    'all',

    'activitypub-cleaner',
    'activitypub-follow',
    'activitypub-http-broadcast-parallel',
    'activitypub-http-broadcast',
    'activitypub-http-fetcher',
    'activitypub-http-unicast',
    'activitypub-refresher',
    'actor-keys',
    'after-video-channel-import',
    'create-user-export',
    'email',
    'federate-video',
    'generate-video-storyboard',
    'manage-video-torrent',
    'move-to-file-system',
    'move-to-object-storage',
    'notify',
    'transcoding-job-builder',
    'video-channel-import',
    'video-file-import',
    'video-import',
    'video-live-ending',
    'video-redundancy',
    'video-studio-edition',
    'video-transcoding',
    'videos-views-stats'
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
    if (this.jobState === 'all' && this.hasGlobalProgress()) return 7

    if (this.jobState === 'all' || this.hasGlobalProgress()) return 6

    return 5
  }

  onJobStateOrTypeChanged () {
    this.pagination.start = 0

    this.reloadData()
    this.saveJobStateAndType()
  }

  hasGlobalProgress () {
    return this.jobType === 'all' || this.jobType === 'video-transcoding'
  }

  hasProgress (job: Job) {
    return job.type === 'video-transcoding'
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

  getRandomJobTypeBadge (type: string) {
    return this.getRandomBadge('type', type)
  }

  protected reloadDataInternal () {
    let jobState = this.jobState as JobState
    if (this.jobState === 'all') jobState = null

    this.jobsService
      .listJobs({
        jobState,
        jobType: this.jobType,
        pagination: this.pagination,
        sort: this.sort
      })
      .subscribe({
        next: resultList => {
          this.jobs = resultList.data
          this.totalRecords = resultList.total
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private loadJobStateAndType () {
    const state = peertubeLocalStorage.getItem(JobsComponent.LOCAL_STORAGE_STATE)

    // FIXME: We use <ng-option> that doesn't escape HTML
    // https://github.com/ng-select/ng-select/issues/1363
    if (state) this.jobState = escapeHTML(state) as JobState

    const type = peertubeLocalStorage.getItem(JobsComponent.LOCAL_STORAGE_TYPE)
    if (type) this.jobType = type as JobType
  }

  private saveJobStateAndType () {
    peertubeLocalStorage.setItem(JobsComponent.LOCAL_STORAGE_STATE, this.jobState)
    peertubeLocalStorage.setItem(JobsComponent.LOCAL_STORAGE_TYPE, this.jobType)
  }
}
