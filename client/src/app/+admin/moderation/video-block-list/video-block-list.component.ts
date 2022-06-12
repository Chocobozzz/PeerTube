import { SortMeta } from 'primeng/api'
import { switchMap } from 'rxjs/operators'
import { buildVideoOrPlaylistEmbed } from 'src/assets/player/utils'
import { environment } from 'src/environments/environment'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { DropdownAction, VideoService } from '@app/shared/shared-main'
import { VideoBlockService } from '@app/shared/shared-moderation'
import { buildVideoEmbedLink, decorateVideoLink } from '@shared/core-utils'
import { VideoBlacklist, VideoBlacklistType } from '@shared/models'

@Component({
  selector: 'my-video-block-list',
  templateUrl: './video-block-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss', './video-block-list.component.scss' ]
})
export class VideoBlockListComponent extends RestTable implements OnInit {
  blocklist: (VideoBlacklist & { reasonHtml?: string })[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }
  blocklistTypeFilter: VideoBlacklistType = undefined

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
                next: () => this.notifier.success($localize`Video deleted.`),

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
    return this.markdownRenderer.textMarkdownToHTML(text)
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
    return buildVideoOrPlaylistEmbed(
      decorateVideoLink({
        url: buildVideoEmbedLink(entry.video, environment.originServerUrl),

        title: false,
        warningTitle: false
      }),
      entry.video.name
    )
  }

  protected reloadData () {
    this.videoBlocklistService.listBlocks({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    })
      .subscribe({
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
