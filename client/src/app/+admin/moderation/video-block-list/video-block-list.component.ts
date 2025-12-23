import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, MarkdownService, Notifier, ServerService } from '@app/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { buildVideoEmbedLink, decorateVideoLink } from '@peertube/peertube-core-utils'
import { ResultList, VideoBlacklist as VideoBlacklistServer, VideoBlacklistType, VideoBlacklistType_Type } from '@peertube/peertube-models'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { switchMap } from 'rxjs/operators'
import { environment } from 'src/environments/environment'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { EmbedComponent } from '../../../shared/shared-main/video/embed.component'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
import { VideoCellComponent } from '../../../shared/shared-tables/video-cell.component'
import { VideoNSFWBadgeComponent } from '../../../shared/shared-video/video-nsfw-badge.component'

type VideoBlacklist = VideoBlacklistServer & { reasonHtml?: string }

@Component({
  selector: 'my-video-block-list',
  templateUrl: './video-block-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss' ],
  imports: [
    AdvancedInputFilterComponent,
    ActionDropdownComponent,
    VideoCellComponent,
    EmbedComponent,
    PTDatePipe,
    VideoNSFWBadgeComponent,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class VideoBlockListComponent implements OnInit {
  private notifier = inject(Notifier)
  private serverService = inject(ServerService)
  private confirmService = inject(ConfirmService)
  private videoBlocklistService = inject(VideoBlockService)
  private markdownRenderer = inject(MarkdownService)
  private videoService = inject(VideoService)

  readonly table = viewChild<TableComponent<VideoBlacklist>>('table')

  blocklistTypeFilter: VideoBlacklistType_Type

  videoBlocklistActions: DropdownAction<VideoBlacklist>[][] = []

  inputFilters: AdvancedInputFilter[] = [
    {
      title: $localize`Advanced filters`,
      children: [
        {
          value: 'type:auto',
          label: $localize`Automatic blocks`
        },
        {
          value: 'type:manual',
          label: $localize`Manual blocks`
        }
      ]
    }
  ]

  columns: TableColumnInfo<string>[] = [
    { id: 'name', label: $localize`Video`, sortable: true },
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
          handler: videoBlock => {
            this.videoBlocklistService.unblockVideo(videoBlock.video.id).pipe(
              switchMap(_ => this.videoBlocklistService.blockVideo([ { videoId: videoBlock.video.id, unfederate: true } ]))
            ).subscribe({
              next: () => {
                this.notifier.success($localize`Video ${videoBlock.video.name} switched to manual block.`)
                this.table().loadData()
              },

              error: err => this.notifier.handleError(err)
            })
          },
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
          handler: videoBlock => this.unblockVideo(videoBlock)
        },

        {
          label: $localize`Delete`,
          handler: async videoBlock => {
            const res = await this.confirmService.confirm(
              $localize`Do you really want to delete this video?`,
              $localize`Delete`
            )
            if (res === false) return

            this.videoService.removeVideo(videoBlock.video.id)
              .subscribe({
                next: () => {
                  this.notifier.success($localize`Video deleted.`)
                  this.table().loadData()
                },

                error: err => this.notifier.handleError(err)
              })
          }
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

    this.videoBlocklistService.unblockVideo(entry.video.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Video ${entry.video.name} unblocked.`)
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

  private _dataLoader (options: DataLoaderOptions) {
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
