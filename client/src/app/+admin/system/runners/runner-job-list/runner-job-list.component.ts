import { CommonModule } from '@angular/common'
import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { buildDropdownSimpleAndBulkActions } from '@app/shared/shared-main/buttons/action-dropdown-helpers'
import { PeerTubeBadgeService } from '@app/shared/shared-main/common/peertube-badge.service'
import { RunnerJob, RunnerJobState, RunnerJobStateType, RunnerJobType } from '@peertube/peertube-models'
import { AdvancedFilterDef } from '../../../../shared/shared-forms/advanced-input-filter.component'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { NumberFormatterPipe } from '../../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '../../../../shared/shared-tables/table.component'
import { RunnerJobFormatted, RunnerService } from '../runner.service'
import { RouterLink } from '@angular/router'

type RunnerJobStateFilter = 'completed' | 'pending' | 'processing' | 'errored'

type DataLoaderParameter = Parameters<RunnerJobListComponent['_dataLoader']>[0]

type ColumnName = 'uuid' | 'type' | 'state' | 'priority' | 'progress' | 'runner' | 'createdAt' | 'processed'

@Component({
  selector: 'my-runner-job-list',
  templateUrl: './runner-job-list.component.html',
  imports: [
    CommonModule,
    RouterLink,
    ActionDropdownComponent,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class RunnerJobListComponent implements OnInit {
  private runnerService = inject(RunnerService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private peertubeBadgeService = inject(PeerTubeBadgeService)

  readonly table = viewChild<TableComponent<RunnerJobFormatted, DataLoaderParameter, ColumnName>>('table')

  actions: DropdownAction<RunnerJob>[][] = []
  bulkActions: DropdownAction<RunnerJob[]>[][] = []

  private jobStates: RunnerJobStateFilter[] = [ 'completed', 'pending', 'processing', 'errored' ]

  private jobTypes: RunnerJobType[] = [
    'vod-web-video-transcoding',
    'vod-hls-transcoding',
    'vod-audio-merge-transcoding',
    'live-rtmp-hls-transcoding',
    'video-studio-transcoding',
    'video-transcription',
    'generate-video-storyboard'
  ]

  inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = [
    {
      type: 'select',
      key: 'type',
      title: $localize`Job type`,
      clearable: true,
      items: this.jobTypes.map(t => ({
        id: t,
        label: t.toLocaleUpperCase(),
        classes: [ 'pt-badge', this.getRandomRunnerTypeBadge(t) ]
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
        classes: [ 'pt-badge', this.getRandomRunnerNameBadge(s) ]
      }))
    }
  ]

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'uuid', label: $localize`UUID`, sortable: false },
    { id: 'type', label: $localize`Type`, sortable: false },
    { id: 'state', label: $localize`State`, sortable: true },
    { id: 'priority', label: $localize`Priority`, sortable: true },
    { id: 'progress', label: $localize`Progress`, sortable: true },
    { id: 'runner', label: $localize`Runner`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'processed', label: $localize`Processed/Finished`, sortable: false }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    const { simpleActions, bulkActions } = buildDropdownSimpleAndBulkActions<RunnerJob>([
      [
        {
          label: $localize`Cancel`,
          handler: jobs => this.cancelJobs(jobs),
          isDisplayed: job => this.canCancelJob(job),
          enableBulk: true
        }
      ],
      [
        {
          label: $localize`Delete`,
          handler: jobs => this.removeJobs(jobs),
          enableBulk: true
        }
      ]
    ])

    this.actions = simpleActions
    this.bulkActions = bulkActions
  }

  // ---------------------------------------------------------------------------

  async cancelJobs (jobs: RunnerJob[]) {
    const message = formatICU(
      $localize`Do you really want to cancel {count, plural, =1 {this job} other {{count} jobs}}? Children jobs will also be cancelled.`,
      { count: jobs.length }
    )

    const res = await this.confirmService.confirm(message, $localize`Cancel`)

    if (res === false) return

    this.runnerService.cancelJobs(jobs)
      .subscribe({
        next: () => {
          this.table().loadData()

          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Job cancelled} other {{count} jobs cancelled}}`,
              { count: jobs.length }
            )
          )
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async removeJobs (jobs: RunnerJob[]) {
    const message = formatICU(
      $localize`Do you really want to remove {count, plural, =1 {this job} other {{count} jobs}}? Children jobs will also be removed.`,
      { count: jobs.length }
    )

    const res = await this.confirmService.confirm(message, $localize`Remove`)

    if (res === false) return

    this.runnerService.removeJobs(jobs)
      .subscribe({
        next: () => {
          this.table().loadData()

          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Job removed} other {{count} jobs removed}}`,
              { count: jobs.length }
            )
          )
        },

        error: err => this.notifier.handleError(err)
      })
  }

  getStateBadgeColor (job: RunnerJob) {
    switch (job.state.id) {
      case RunnerJobState.ERRORED:
      case RunnerJobState.PARENT_ERRORED:
        return 'badge-danger'

      case RunnerJobState.COMPLETED:
        return 'badge-success'

      case RunnerJobState.PENDING:
      case RunnerJobState.WAITING_FOR_PARENT_JOB:
        return 'badge-warning'

      default:
        return 'badge-info'
    }
  }

  getRandomRunnerNameBadge (value: string) {
    return this.peertubeBadgeService.getRandomBadge('runner', value)
  }

  getRandomRunnerTypeBadge (value: string) {
    return this.peertubeBadgeService.getRandomBadge('type', value)
  }

  getTypeFilterTitle (type: string) {
    return $localize`Filter jobs by type: ${type.toLocaleUpperCase()}`
  }

  getStateFilterTitle (state: string) {
    return $localize`Filter jobs by state: ${state.toLocaleUpperCase()}`
  }

  private _dataLoader (
    options: DataLoaderOptionsBase & {
      state?: RunnerJobStateFilter
      type?: RunnerJobType
    }
  ) {
    const { pagination, sort, search, state, type } = options

    let stateOneOf: RunnerJobStateType[]
    let typeOneOf: RunnerJobType[]

    if (state) {
      stateOneOf = []

      if (state === 'completed') stateOneOf.push(RunnerJobState.COMPLETED)
      else if (state === 'pending') {
        stateOneOf.push(RunnerJobState.PENDING)
        stateOneOf.push(RunnerJobState.WAITING_FOR_PARENT_JOB)
      } else if (state === 'processing') stateOneOf.push(RunnerJobState.PROCESSING)
      else if (state === 'errored') {
        stateOneOf.push(RunnerJobState.ERRORED)
        stateOneOf.push(RunnerJobState.PARENT_ERRORED)
      }
    }

    if (type) {
      typeOneOf = [ type ]
    }

    return this.runnerService.listRunnerJobs({ pagination, sort, search, stateOneOf, typeOneOf })
  }

  private canCancelJob (job: RunnerJob) {
    return job.state.id === RunnerJobState.PENDING ||
      job.state.id === RunnerJobState.PROCESSING ||
      job.state.id === RunnerJobState.WAITING_FOR_PARENT_JOB
  }
}
