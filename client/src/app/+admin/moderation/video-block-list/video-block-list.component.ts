import { SortMeta } from 'primeng/api'
import { filter, switchMap } from 'rxjs/operators'
import { AfterViewInit, Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { VideoBlockService } from '@app/shared/shared-moderation'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoBlacklist, VideoBlacklistType } from '@shared/models'
import { buildVideoOrPlaylistEmbed, buildVideoLink } from 'src/assets/player/utils'
import { environment } from 'src/environments/environment'
import { DomSanitizer } from '@angular/platform-browser'

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
    private notifier: Notifier,
    private serverService: ServerService,
    private confirmService: ConfirmService,
    private videoBlocklistService: VideoBlockService,
    private markdownRenderer: MarkdownService,
    private sanitizer: DomSanitizer,
    private videoService: VideoService,
    private route: ActivatedRoute,
    private router: Router,
    private i18n: I18n
  ) {
    super()

    this.videoBlocklistActions = [
      [
        {
          label: this.i18n('Internal actions'),
          isHeader: true,
          isDisplayed: videoBlock => videoBlock.type === VideoBlacklistType.AUTO_BEFORE_PUBLISHED
        },
        {
          label: this.i18n('Switch video block to manual'),
          handler: videoBlock => {
            this.videoBlocklistService.unblockVideo(videoBlock.video.id).pipe(
              switchMap(_ => this.videoBlocklistService.blockVideo(videoBlock.video.id, undefined, true))
            ).subscribe(
              () => {
                this.notifier.success(this.i18n('Video {{name}} switched to manual block.', { name: videoBlock.video.name }))
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
          label: this.i18n('Actions for the video'),
          isHeader: true
        },
        {
          label: this.i18n('Unblock'),
          handler: videoBlock => this.unblockVideo(videoBlock)
        },

        {
          label: this.i18n('Delete'),
          handler: async videoBlock => {
            const res = await this.confirmService.confirm(
              this.i18n('Do you really want to delete this video?'),
              this.i18n('Delete')
            )
            if (res === false) return

            this.videoService.removeVideo(videoBlock.video.id)
              .subscribe(
                () => {
                  this.notifier.success(this.i18n('Video deleted.'))
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

    this.route.queryParams
      .pipe(filter(params => params.search !== undefined && params.search !== null))
      .subscribe(params => {
        this.search = params.search
        this.setTableFilter(params.search)
        this.loadData()
      })
  }

  ngAfterViewInit () {
    if (this.search) this.setTableFilter(this.search)
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

  booleanToText (value: boolean) {
    if (value === true) return this.i18n('yes')

    return this.i18n('no')
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }

  async unblockVideo (entry: VideoBlacklist) {
    const confirmMessage = this.i18n(
      'Do you really want to unblock this video? It will be available again in the videos list.'
    )

    const res = await this.confirmService.confirm(confirmMessage, this.i18n('Unblock'))
    if (res === false) return

    this.videoBlocklistService.unblockVideo(entry.video.id).subscribe(
      () => {
        this.notifier.success(this.i18n('Video {{name}} unblocked.', { name: entry.video.name }))
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  getVideoEmbed (entry: VideoBlacklist) {
    return buildVideoOrPlaylistEmbed(
      buildVideoLink({
        baseUrl: `${environment.embedUrl}/videos/embed/${entry.video.uuid}`,
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
