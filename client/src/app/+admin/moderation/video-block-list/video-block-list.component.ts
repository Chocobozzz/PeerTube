import { SortMeta, SharedModule } from 'primeng/api'
import { switchMap } from 'rxjs/operators'
import { environment } from 'src/environments/environment'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { buildVideoEmbedLink, decorateVideoLink } from '@peertube/peertube-core-utils'
import { VideoBlacklist, VideoBlacklistType, VideoBlacklistType_Type } from '@peertube/peertube-models'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { EmbedComponent } from '../../../shared/shared-main/video/embed.component'
import { AutoColspanDirective } from '../../../shared/shared-main/angular/auto-colspan.directive'
import { VideoCellComponent } from '../../../shared/shared-tables/video-cell.component'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { TableExpanderIconComponent } from '../../../shared/shared-tables/table-expander-icon.component'
import { NgIf, NgClass, DatePipe } from '@angular/common'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { TableModule } from 'primeng/table'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'

@Component({
  selector: 'my-video-block-list',
  templateUrl: './video-block-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss', './video-block-list.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    TableModule,
    SharedModule,
    AdvancedInputFilterComponent,
    NgbTooltip,
    NgIf,
    TableExpanderIconComponent,
    ActionDropdownComponent,
    NgClass,
    VideoCellComponent,
    AutoColspanDirective,
    EmbedComponent,
    DatePipe
  ]
})
export class VideoBlockListComponent extends RestTable implements OnInit {
  blocklist: (VideoBlacklist & { reasonHtml?: string })[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }
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

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private notifier: Notifier,
    private serverService: ServerService,
    private confirmService: ConfirmService,
    private videoBlocklistService: VideoBlockService,
    private markdownRenderer: MarkdownService,
    private videoService: VideoService
  ) {
    super()

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
                this.reloadData()
              },

              error: err => this.notifier.error(err.message)
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
                  this.reloadData()
                },

                error: err => this.notifier.error(err.message)
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

    this.initialize()
  }

  getIdentifier () {
    return 'VideoBlockListComponent'
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
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
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

  protected reloadDataInternal () {
    this.videoBlocklistService.listBlocks({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe({
      next: async resultList => {
        this.totalRecords = resultList.total

        this.blocklist = resultList.data

        for (const element of this.blocklist) {
          Object.assign(element, {
            reasonHtml: await this.toHtml(element.reason)
          })
        }
      },

      error: err => this.notifier.error(err.message)
    })
  }
}
