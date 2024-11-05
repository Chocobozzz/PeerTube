import { NgClass, NgFor, NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { AutoColspanDirective } from '@app/shared/shared-main/common/auto-colspan.directive'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { Job, JobState, JobType } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { SelectOptionsItem } from 'src/types'
import { JobStateClient } from '../../../../types/job-state-client.type'
import { JobTypeClient } from '../../../../types/job-type-client.type'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { TableExpanderIconComponent } from '../../../shared/shared-tables/table-expander-icon.component'
import { JobService } from './job.service'

@Component({
  selector: 'my-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: [ './jobs.component.scss' ],
  standalone: true,
  imports: [
    FormsModule,
    NgFor,
    NgClass,
    ButtonComponent,
    TableModule,
    SharedModule,
    NgIf,
    NgbTooltip,
    TableExpanderIconComponent,
    GlobalIconComponent,
    SelectOptionsComponent,
    AutoColspanDirective
  ]
})
export class JobsComponent extends RestTable implements OnInit {
  private static LS_STATE = 'jobs-list-state'
  private static LS_TYPE = 'jobs-list-type'

  jobState?: JobStateClient
  jobStates: JobStateClient[] = [ 'all', 'active', 'completed', 'failed', 'waiting', 'delayed' ]
  jobStateItems: SelectOptionsItem[] = this.jobStates.map(s => ({
    id: s,
    label: s,
    classes: this.getJobStateClasses(s)
  }))

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
    'video-transcription',
    'videos-views-stats'
  ]
  jobTypeItems: SelectOptionsItem[] = this.jobTypes.map(i => ({ id: i, label: i }))

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

  getJobStateClasses (state: JobStateClient) {
    switch (state) {
      case 'active':
        return [ 'pt-badge', 'badge-blue' ]
      case 'completed':
        return [ 'pt-badge', 'badge-green' ]
      case 'delayed':
        return [ 'pt-badge', 'badge-brown' ]
      case 'failed':
        return [ 'pt-badge', 'badge-red' ]
      case 'waiting':
        return [ 'pt-badge', 'badge-yellow' ]
    }

    return []
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
    const state = peertubeLocalStorage.getItem(JobsComponent.LS_STATE)
    if (state) this.jobState = state as JobState

    const jobType = peertubeLocalStorage.getItem(JobsComponent.LS_TYPE)
    if (jobType) this.jobType = jobType as JobType
  }

  private saveJobStateAndType () {
    peertubeLocalStorage.setItem(JobsComponent.LS_STATE, this.jobState)
    peertubeLocalStorage.setItem(JobsComponent.LS_TYPE, this.jobType)
  }
}
