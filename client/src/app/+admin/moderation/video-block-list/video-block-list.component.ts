import { SortMeta } from 'primeng/api'
import { switchMap } from 'rxjs/operators'
import { buildVideoLink, buildVideoOrPlaylistEmbed } from 'src/assets/player/utils'
import { environment } from 'src/environments/environment'
import { AfterViewInit, Component, OnInit } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { VideoBlockService } from '@app/shared/shared-moderation'
import { VideoBlacklist, VideoBlacklistType } from '@shared/models'

@Component({
  selector: 'my-video-block-list',
  templateUrl: './video-block-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss', './video-block-list.component.scss' ]
})
export class VideoBlockListComponent extends RestTable implements OnInit, AfterViewInit {
  blocklist: (VideoBlacklist & { reasonHtml?: string, embedHtml?: string })[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }
  blocklistTypeFilter: VideoBlacklistType = undefined

  videoBlocklistActions: DropdownAction<VideoBlacklist>[][] = []

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private notifier: Notifier,
    private serverService: ServerService,
    private confirmService: ConfirmService,
    private videoBlocklistService: VideoBlockService,
    private markdownRenderer: MarkdownService,
    private sanitizer: DomSanitizer,
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
              switchMap(_ => this.videoBlocklistService.blockVideo(videoBlock.video.id, undefined, true))
            ).subscribe(
              () => {
                this.notifier.success($localize`Video ${videoBlock.video.name} switched to manual block.`)
                this.loadData()
              },

              err => this.notifier.error(err.message)
            )
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
              .subscribe(
                () => {
                  this.notifier.success($localize`Video deleted.`)
                },

                err => this.notifier.error(err.message)
              )
          }
        }
      ]
    ]
  }

  ngOnInit () {
    this.serverService.getConfig()
        .subscribe(config => {
          // don't filter if auto-blacklist is not enabled as this will be the only list
          if (config.autoBlacklist.videos.ofUsers.enabled) {
            this.blocklistTypeFilter = VideoBlacklistType.MANUAL
          }
        })

    this.initialize()
    this.listenToSearchChange()
  }

  ngAfterViewInit () {
    if (this.search) this.setTableFilter(this.search, false)
  }

  /* Table filter functions */
  onBlockSearch (event: Event) {
    this.onSearch(event)
    this.setQueryParams((event.target as HTMLInputElement).value)
  }

  setQueryParams (search: string) {
    const queryParams: Params = {}
    if (search) Object.assign(queryParams, { search })
    this.router.navigate([ '/admin/moderation/video-blocks/list' ], { queryParams })
  }

  resetTableFilter () {
    this.setTableFilter('')
    this.setQueryParams('')
    this.resetSearch()
  }
  /* END Table filter functions */

  getIdentifier () {
    return 'VideoBlockListComponent'
  }

  getVideoUrl (videoBlock: VideoBlacklist) {
    return Video.buildClientUrl(videoBlock.video.uuid)
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }

  async unblockVideo (entry: VideoBlacklist) {
    const confirmMessage = $localize`Do you really want to unblock this video? It will be available again in the videos list.`

    const res = await this.confirmService.confirm(confirmMessage, $localize`Unblock`)
    if (res === false) return

    this.videoBlocklistService.unblockVideo(entry.video.id).subscribe(
      () => {
        this.notifier.success($localize`Video ${entry.video.name} unblocked.`)
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  getVideoEmbed (entry: VideoBlacklist) {
    return buildVideoOrPlaylistEmbed(
      buildVideoLink({
        baseUrl: `${environment.originServerUrl}/videos/embed/${entry.video.uuid}`,
        title: false,
        warningTitle: false
      })
    )
  }

  protected loadData () {
    this.videoBlocklistService.listBlocks({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    })
      .subscribe(
        async resultList => {
          this.totalRecords = resultList.total

          this.blocklist = resultList.data

          for (const element of this.blocklist) {
            Object.assign(element, {
              reasonHtml: await this.toHtml(element.reason),
              embedHtml: this.sanitizer.bypassSecurityTrustHtml(this.getVideoEmbed(element))
            })
          }
        },

        err => this.notifier.error(err.message)
      )
  }
}
