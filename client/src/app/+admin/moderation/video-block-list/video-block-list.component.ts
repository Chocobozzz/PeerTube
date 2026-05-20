import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, MarkdownService, Notifier, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { buildDropdownSimpleAndBulkActions } from '@app/shared/shared-main/buttons/action-dropdown-helpers'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { AccountBlockBadgeInput } from '@app/shared/shared-moderation/account-block-badges.component'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockInternalNoteModalComponent } from '@app/shared/shared-moderation/video-block-internal-note-modal.component'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { PrivacyBadgeComponent } from '@app/shared/shared-video/privacy-badge.component'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { buildVideoEmbedLink, decorateVideoLink } from '@peertube/peertube-core-utils'
import { ResultList, VideoBlacklist as VideoBlacklistServer, VideoBlacklistType, VideoBlacklistType_Type } from '@peertube/peertube-models'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { switchMap } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'
import { AdvancedFilterDef } from '../../../shared/shared-forms/advanced-input-filter.component'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { Nl2BrPipe } from '../../../shared/shared-main/common/nl2br.pipe'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { EmbedComponent } from '../../../shared/shared-main/video/embed.component'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
import { VideoCellComponent } from '../../../shared/shared-tables/video-cell.component'
import { VideoNSFWBadgeComponent } from '../../../shared/shared-video/video-nsfw-badge.component'

type DataLoaderParameter = Parameters<VideoBlockListComponent['_dataLoader']>[0]
type VideoBlacklist = VideoBlacklistServer & { reasonHtml?: string }

@Component({
  selector: 'my-video-block-list',
  templateUrl: './video-block-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss' ],
  imports: [
    ActionDropdownComponent,
    VideoCellComponent,
    EmbedComponent,
    PTDatePipe,
    VideoNSFWBadgeComponent,
    TableComponent,
    NumberFormatterPipe,
    PrivacyBadgeComponent,
    NgbTooltipModule,
    VideoBlockInternalNoteModalComponent,
    Nl2BrPipe
  ]
})
export class VideoBlockListComponent implements OnInit {
  private notifier = inject(Notifier)
  private serverService = inject(ServerService)
  private confirmService = inject(ConfirmService)
  private videoBlocklistService = inject(VideoBlockService)
  private blocklistService = inject(BlocklistService)
  private markdownRenderer = inject(MarkdownService)
  private videoService = inject(VideoService)

  readonly table = viewChild<TableComponent<VideoBlacklist, DataLoaderParameter>>('table')
  readonly internalNoteModal = viewChild<VideoBlockInternalNoteModalComponent>('internalNoteModal')

  blocklistTypeFilter: VideoBlacklistType_Type

  videoBlocklistActions: DropdownAction<VideoBlacklist>[][] = []
  bulkActions: DropdownAction<VideoBlacklist[]>[][] = []

  inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = [
    {
      type: 'options',
      key: 'type',
      title: $localize`Block type`,
      options: [
        { value: 'all', label: $localize`All` },
        { value: VideoBlacklistType.AUTO_BY_INSTANCE_POLICY, label: $localize`Auto-block by instance policy` },
        { value: VideoBlacklistType.AUTO_BY_AUTO_TAG_POLICY, label: $localize`Auto-block by auto-tag policy` },
        { value: VideoBlacklistType.MANUAL, label: $localize`Manual blocks` }
      ]
    }
  ]

  columns: TableColumnInfo<string>[] = [
    { id: 'name', label: $localize`Video`, sortable: true },
    { id: 'privacy', label: $localize`Privacy`, sortable: false },
    { id: 'sensitive', label: $localize`Sensitive`, sortable: false },
    { id: 'unfederated', label: $localize`Unfederated`, sortable: false },
    { id: 'internalNote', label: $localize`Internal note`, sortable: false },
    { id: 'createdAt', label: $localize`Date`, sortable: true }
  ]

  // Key is account id
  accountBlocklist = new Map<number, AccountBlockBadgeInput>()

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)

    const { simpleActions, bulkActions } = buildDropdownSimpleAndBulkActions<VideoBlacklist>([
      [
        {
          label: () => $localize`Internal actions`,
          isHeader: true,
          enableBulk: true
        },
        {
          label: () => $localize`Switch to manual block`,
          handler: videoBlocks => this.switchVideosBlockToManual(videoBlocks),
          isDisplayed: videoBlock => videoBlock.type !== VideoBlacklistType.MANUAL,
          enableBulk: true
        },
        {
          label: () => $localize`Set internal note...`,
          handler: entries => this.internalNoteModal().openModal(entries),
          enableBulk: true
        }
      ],
      [
        {
          label: () => $localize`Actions for videos`,
          isHeader: true,
          enableBulk: true
        },

        {
          label: () => $localize`Unblock`,
          handler: entries => this.unblockVideos(entries),
          enableBulk: true
        },
        {
          label: entries => formatICU($localize`{count, plural, =1 {Delete video} other {Delete videos}}`, { count: entries.length }),
          handler: entries => this.deleteVideos(entries),
          isDisplayed: videoBlock => videoBlock.video?.isLocal === true,
          enableBulk: true
        }
      ]
    ])

    this.videoBlocklistActions = simpleActions
    this.bulkActions = bulkActions
  }

  ngOnInit () {
    const serverConfig = this.serverService.getHTMLConfig()

    // Don't filter if auto-blacklist is not enabled as this will be the only list
    if (serverConfig.autoBlacklist.videos.ofUsers.enabled) {
      this.blocklistTypeFilter = VideoBlacklistType.MANUAL
    }
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text })
  }

  async unblockVideo (entry: VideoBlacklist) {
    const confirmMessage = $localize`Do you really want to unblock this video? It will be available again in the videos list.`

    const res = await this.confirmService.confirm(confirmMessage, $localize`Unblock`)
    if (res === false) return

    this.videoBlocklistService.unblockVideos([ entry.video.id ])
      .subscribe({
        next: () => {
          this.notifier.success($localize`Video ${entry.video.name} unblocked.`)
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async unblockVideos (entries: VideoBlacklist[]) {
    const confirmMessage = formatICU(
      $localize`Do you really want to unblock {count, plural, =1 {this video?} other {these {count} videos?}}`,
      { count: entries.length }
    )

    const res = await this.confirmService.confirm(confirmMessage, $localize`Unblock`)
    if (res === false) return

    this.videoBlocklistService.unblockVideos(entries.map(entry => entry.video.id))
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Video unblocked.} other {{count} videos unblocked.}}`,
              { count: entries.length }
            )
          )
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async switchVideosBlockToManual (entries: VideoBlacklist[]) {
    const res = await this.confirmService.confirm(
      formatICU(
        $localize`Switch {count, plural, =1 {this auto block to manual?} other {{count} auto blocks to manual?}}`,
        { count: entries.length }
      ),
      $localize`Switch`
    )
    if (res === false) return

    const videoIds = entries.map(entry => entry.video.id)

    this.videoBlocklistService.unblockVideos(videoIds).pipe(
      switchMap(() => this.videoBlocklistService.blockVideos(videoIds.map(videoId => ({ videoId, unfederate: true }))))
    ).subscribe({
      next: () => {
        this.notifier.success(
          formatICU(
            $localize`{count, plural, =1 {Video switched to manual block.} other {{count} videos switched to manual block.}}`,
            { count: entries.length }
          )
        )
        this.table().loadData()
      },

      error: err => this.notifier.handleError(err)
    })
  }

  async deleteVideos (entries: VideoBlacklist[]) {
    const res = await this.confirmService.confirm(
      formatICU(
        $localize`Do you really want to delete {count, plural, =1 {this video?} other {{count} videos?}}`,
        { count: entries.length }
      ),
      $localize`Delete`
    )
    if (res === false) return

    this.videoService.removeVideo(entries.map(entry => entry.video.id))
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Video deleted.} other {{count} videos deleted.}}`,
              { count: entries.length }
            )
          )
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  getVideoEmbed (entry: VideoBlacklist) {
    return buildVideoOrPlaylistEmbed({
      embedUrl: decorateVideoLink({
        url: buildVideoEmbedLink(entry.video, environment.originServerUrl),

        title: false,
        warningTitle: false
      }),
      aspectRatio: entry.video.aspectRatio,
      embedTitle: entry.video.name
    })
  }

  onDataLoaded () {
    this.loadBlockStatus()
  }

  loadBlockStatus () {
    const videos = this.table().data.map(entry => entry.video)

    const accounts = this.getUniqueAccounts(videos)
    const hosts = this.getUniqueHosts(accounts)

    this.blocklistService.getStatus({ accounts: accounts.map(a => a.name + '@' + a.host), hosts })
      .subscribe(status => {
        this.accountBlocklist = new Map()

        for (const a of accounts) {
          const handle = a.name + '@' + a.host

          this.accountBlocklist.set(a.id, {
            mutedByInstance: status.accounts[handle]?.blockedByServer ?? false,
            mutedServerByInstance: status.hosts[a.host]?.blockedByServer ?? false
          })
        }
      })
  }

  private getUniqueAccounts (videos: { account: { id: number, name: string, host: string } }[]) {
    const accountsDone = new Set<number>()

    return videos
      .map(video => {
        if (!video.account || accountsDone.has(video.account.id)) return null

        accountsDone.add(video.account.id)
        return video.account
      })
      .filter(a => !!a)
  }

  private getUniqueHosts (accounts: { host: string }[]) {
    return Array.from(new Set(accounts.map(a => a.host)))
  }

  private _dataLoader (options: DataLoaderOptionsBase & { type?: VideoBlacklistType_Type }) {
    return this.videoBlocklistService.listBlocks(options)
      .pipe(
        switchMap(async (resultList: ResultList<VideoBlacklist>) => {
          for (const element of resultList.data) {
            element.reasonHtml = await this.toHtml(element.reason)
          }

          return resultList
        })
      )
  }
}
