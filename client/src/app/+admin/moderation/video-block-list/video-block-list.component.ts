import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, MarkdownService, Notifier, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { PrivacyBadgeComponent } from '@app/shared/shared-video/privacy-badge.component'
import { buildVideoEmbedLink, decorateVideoLink } from '@peertube/peertube-core-utils'
import { ResultList, VideoBlacklist as VideoBlacklistServer, VideoBlacklistType, VideoBlacklistType_Type } from '@peertube/peertube-models'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { switchMap } from 'rxjs/operators'
import { environment } from 'src/environments/environment'
import { AdvancedFilterDef } from '../../../shared/shared-forms/advanced-input-filter.component'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
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
    PrivacyBadgeComponent
  ]
})
export class VideoBlockListComponent implements OnInit {
  private notifier = inject(Notifier)
  private serverService = inject(ServerService)
  private confirmService = inject(ConfirmService)
  private videoBlocklistService = inject(VideoBlockService)
  private markdownRenderer = inject(MarkdownService)
  private videoService = inject(VideoService)

  readonly table = viewChild<TableComponent<VideoBlacklist, DataLoaderParameter>>('table')

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
        { value: VideoBlacklistType['AUTO_BEFORE_PUBLISHED'], label: $localize`Automatic blocks` },
        { value: VideoBlacklistType['MANUAL'], label: $localize`Manual blocks` }
      ]
    }
  ]

  columns: TableColumnInfo<string>[] = [
    { id: 'name', label: $localize`Video`, sortable: true },
    { id: 'privacy', label: $localize`Privacy`, sortable: false },
    { id: 'sensitive', label: $localize`Sensitive`, sortable: false },
    { id: 'unfederated', label: $localize`Unfederated`, sortable: false },
    { id: 'createdAt', label: $localize`Date`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)

    this.videoBlocklistActions = [
      [
        {
          label: $localize`Internal actions`,
          isHeader: true,
          isDisplayed: videoBlock => videoBlock.type === VideoBlacklistType.AUTO_BEFORE_PUBLISHED
        },
        {
          label: $localize`Switch video block to manual`,
          handler: videoBlock => this.switchVideosBlockToManual([ videoBlock ]),
          isDisplayed: videoBlock => videoBlock.type === VideoBlacklistType.AUTO_BEFORE_PUBLISHED
        }
      ],
      [
        {
          label: $localize`Actions for the video`,
          isHeader: true
        },
        {
          label: $localize`Unblock`,
          handler: videoBlock => this.unblockVideos([ videoBlock ])
        },

        {
          label: $localize`Delete video`,
          handler: videoBlock => this.deleteVideos([ videoBlock ])
        }
      ]
    ]

    this.bulkActions = [
      [
        {
          label: $localize`Internal actions`,
          isHeader: true,
          isDisplayed: entries => entries.every(entry => entry.type === VideoBlacklistType.AUTO_BEFORE_PUBLISHED)
        },
        {
          label: $localize`Switch videos block to manual`,
          handler: entries => this.switchVideosBlockToManual(entries),
          isDisplayed: entries => entries.every(entry => entry.type === VideoBlacklistType.AUTO_BEFORE_PUBLISHED)
        }
      ],
      [
        {
          label: $localize`Actions for videos`,
          isHeader: true
        },
        {
          label: $localize`Unblock`,
          handler: entries => this.unblockVideos(entries)
        },
        {
          label: $localize`Delete video`,
          handler: entries => this.deleteVideos(entries)
        }
      ]
    ]
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
