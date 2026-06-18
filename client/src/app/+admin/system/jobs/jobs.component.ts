import { CommonModule } from '@angular/common'
import { Component, inject, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { ConfirmService, Notifier, RestPagination, ServerService } from '@app/core'
import { AdvancedFilterDef } from '@app/shared/shared-forms/advanced-input-filter.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { PeerTubeBadgeService } from '@app/shared/shared-main/common/peertube-badge.service'
import { Job, JobState, JobType } from '@peertube/peertube-models'
import { arrayOfAllFactory } from '@peertube/peertube-typescript-utils'
import { SortMeta } from 'primeng/api'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
import { JobService } from './job.service'

type ColumnName = 'id' | 'type' | 'priority' | 'state' | 'progress' | 'createdAt' | 'processed' | 'actions'
type DataLoaderParameter = Parameters<JobsComponent['_dataLoader']>[0]

@Component({
  selector: 'my-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: [ './jobs.component.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    TableComponent,
    NumberFormatterPipe,
    RouterLink,
    ButtonComponent
  ]
})
export class JobsComponent {
  private server = inject(ServerService)
  private jobsService = inject(JobService)
  private peertubeBadgeService = inject(PeerTubeBadgeService)
  private notifier = inject(Notifier)
  private confirm = inject(ConfirmService)

  readonly table = viewChild<TableComponent<Job, DataLoaderParameter, ColumnName>>('table')

  private jobStates: JobState[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed' ]

  private jobTypes = arrayOfAllFactory<JobType>()([
    'activitypub-cleaner',
    'activitypub-follow',
    'activitypub-http-broadcast-parallel',
    'activitypub-http-broadcast',
    'activitypub-http-fetcher',
    'activitypub-http-unicast',
    'activitypub-refresher',
    'actor-keys',
    'after-video-channel-import',
    'build-automatic-tags',
    'create-user-export',
    'email',
    'federate-video',
    'generate-video-storyboard',
    'import-user-archive',
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
    'videos-stats'
  ])

  readonly inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = [
    {
      type: 'select',
      key: 'type',
      title: $localize`Job type`,
      clearable: true,
      filter: true,
      items: this.jobTypes.map(i => ({
        id: i,
        label: i.toLocaleUpperCase(),
        classes: [ 'pt-badge', this.getRandomJobTypeBadge(i) ]
      }))
    },
    {
      type: 'select',
      key: 'state',
      title: $localize`Job state`,
      clearable: true,
      items: this.jobStates.map(s => ({
        id: s,
        label: s.toLocaleUpperCase(),
        classes: this.getJobStateClasses(s)
      }))
    }
  ]

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'id', class: 'job-id', label: $localize`ID`, sortable: false },
    { id: 'type', class: 'job-type', label: $localize`Type`, sortable: false },
    { id: 'priority', class: 'job-priority', label: $localize`Priority`, labelSmall: $localize`(1 = highest priority)`, sortable: false },
    { id: 'state', class: 'job-state', label: $localize`State`, sortable: false },
    { id: 'progress', class: 'job-progress', label: $localize`Progress`, isDisplayed: () => this.displayGlobalProgress, sortable: false },
    { id: 'createdAt', class: 'job-date', label: $localize`Created`, sortable: true },
    { id: 'processed', label: $localize`Processed/Finished`, sortable: false },
    { id: 'actions', label: $localize`Actions`, sortable: false }
  ]
  dataLoader: typeof this._dataLoader

  displayGlobalProgress = true

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  getJobStateClasses (state: JobState): string[] {
    switch (state) {
      case undefined:
      case null:
        return []

      case 'active':
        return [ 'pt-badge', 'badge-blue' ]

      case 'completed':
        return [ 'pt-badge', 'badge-green' ]

      case 'delayed':
      case 'prioritized':
      case 'paused':
        return [ 'pt-badge', 'badge-brown' ]

      case 'failed':
        return [ 'pt-badge', 'badge-red' ]

      case 'waiting':
      case 'waiting-children':
        return [ 'pt-badge', 'badge-yellow' ]
    }

    // Do not remove, to ensure all cases are handled by the switch
    return state
  }

  hasProgress (job: Job) {
    return job.type === 'video-transcoding'
  }

  getProgress (job: Job) {
    if (job.state === 'active') return job.progress + '%'

    return ''
  }

  getRandomJobTypeBadge (type: string) {
    return this.peertubeBadgeService.getRandomBadge('type', type)
  }

  getStateFilterTitle (state: string) {
    return $localize`Filter by state: ${state.toLocaleUpperCase()}`
  }

  getTypeFilterTitle (type: string) {
    return $localize`Filter by type: ${type.toLocaleUpperCase()}`
  }

  isRunnerEnabled () {
    return this.server.isRemoteRunnersEnabled()
  }

  async cancelJob (job: Job) {
    if (!job.canCancel) return

    const res = await this.confirm.confirm($localize`Are you sure you want to cancel job ${job.id}?`, $localize`Cancel job`, {
      confirmButtonText: $localize`Cancel job`,
      cancelButtonText: $localize`Keep job`
    })

    if (!res) return

    this.jobsService.cancelJob({ jobId: job.id, jobType: job.type })
      .subscribe({
        next: () => {
          this.notifier.success($localize`Job ${job.id} cancellation requested`)
          this.table()?.loadData()
        },
        error: err => this.notifier.error(err.message, $localize`Cannot cancel job ${job.id}`)
      })
  }

  private _dataLoader (options: {
    pagination: RestPagination
    sort: SortMeta
    type?: JobType
    state?: JobState
  }) {
    const { pagination, sort, type, state } = options

    this.displayGlobalProgress = !type || type === 'video-transcoding'

    return this.jobsService.listJobs({
      jobState: state,
      jobType: type,
      pagination,
      sort
    })
  }
}
