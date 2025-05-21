import { CommonModule } from '@angular/common'
import { Component, OnInit, inject, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RestPagination } from '@app/core'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'

import { Job, JobState, JobType } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { SortMeta } from 'primeng/api'
import { SelectOptionsItem } from 'src/types'
import { JobStateClient } from '../../../../types/job-state-client.type'
import { JobTypeClient } from '../../../../types/job-type-client.type'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { TableColumnInfo, TableComponent, TableQueryParams } from '../../../shared/shared-tables/table.component'
import { JobService } from './job.service'

type ColumnName = 'id' | 'type' | 'priority' | 'state' | 'progress' | 'createdAt' | 'processed'

type QueryParams = TableQueryParams & {
  jobType: string
  jobState: string
}

@Component({
  selector: 'my-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: [ './jobs.component.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    SelectOptionsComponent,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class JobsComponent implements OnInit {
  private static LS_STATE = 'jobs-list-state'
  private static LS_TYPE = 'jobs-list-type'

  private jobsService = inject(JobService)

  readonly table = viewChild<TableComponent<Job, ColumnName>>('table')

  jobState: JobStateClient = 'all'
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

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'id', class: 'job-id', label: $localize`ID`, sortable: false },
    { id: 'type', class: 'job-type', label: $localize`Type`, sortable: false },
    { id: 'priority', class: 'job-priority', label: $localize`Priority`, labelSmall: $localize`(1 = highest priority)`, sortable: false },
    { id: 'state', class: 'job-state', label: $localize`State`, isDisplayed: () => this.jobState === 'all', sortable: false },
    { id: 'progress', class: 'job-progress', label: $localize`Progress`, isDisplayed: () => this.hasGlobalProgress(), sortable: false },
    { id: 'createdAt', class: 'job-date', label: $localize`Created`, sortable: true },
    { id: 'processed', label: $localize`Processed/Finished`, sortable: false }
  ]
  customUpdateUrl: typeof this._customUpdateUrl
  customParseQueryParams: typeof this._customParseQueryParams
  dataLoader: typeof this._dataLoader

  constructor () {
    this.customUpdateUrl = this._customUpdateUrl.bind(this)
    this.customParseQueryParams = this._customParseQueryParams.bind(this)
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    this.loadJobStateAndType()
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
    this.table().onFilter()
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

  getRandomJobTypeBadge (type: string) {
    return this.table().getRandomBadge('type', type)
  }

  private _customUpdateUrl (): Partial<QueryParams> {
    return {
      jobType: this.jobType,
      jobState: this.jobState
    }
  }

  private _customParseQueryParams (queryParams: QueryParams) {
    if (queryParams.jobType) {
      this.jobType = queryParams.jobType as JobTypeClient
    }

    if (queryParams.jobState) {
      this.jobState = queryParams.jobState as JobStateClient
    }
  }

  private _dataLoader (options: {
    pagination: RestPagination
    sort: SortMeta
  }) {
    const { pagination, sort } = options

    let jobState = this.jobState as JobState
    if (this.jobState === 'all') jobState = null

    return this.jobsService.listJobs({
      jobState,
      jobType: this.jobType,
      pagination,
      sort
    })
  }

  private loadJobStateAndType () {
    const state = peertubeLocalStorage.getItem(JobsComponent.LS_STATE)
    if (state && state !== 'undefined') this.jobState = state as JobState

    const jobType = peertubeLocalStorage.getItem(JobsComponent.LS_TYPE)
    if (jobType && jobType !== 'undefined') this.jobType = jobType as JobType
  }

  private saveJobStateAndType () {
    peertubeLocalStorage.setItem(JobsComponent.LS_STATE, this.jobState)
    peertubeLocalStorage.setItem(JobsComponent.LS_TYPE, this.jobType)
  }
}
