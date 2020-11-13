import { SortMeta } from 'primeng/api'
import { filter } from 'rxjs/operators'
import { AfterViewInit, Component, OnInit } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { DropdownAction, VideoService } from '@app/shared/shared-main'
import { VideoCommentAdmin, VideoCommentService } from '@app/shared/shared-video-comment'

@Component({
  selector: 'my-video-comment-list',
  templateUrl: './video-comment-list.component.html',
  styleUrls: [ './video-comment-list.component.scss' ]
})
export class VideoCommentListComponent extends RestTable implements OnInit, AfterViewInit {
  comments: VideoCommentAdmin[]
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  videoCommentActions: DropdownAction<VideoCommentAdmin>[][] = []

  constructor (
    private notifier: Notifier,
    private serverService: ServerService,
    private confirmService: ConfirmService,
    private videoCommentService: VideoCommentService,
    private markdownRenderer: MarkdownService,
    private sanitizer: DomSanitizer,
    private videoService: VideoService,
    private route: ActivatedRoute,
    private router: Router
    ) {
    super()

    this.videoCommentActions = [
      [

        // remove this comment,

        // remove all comments of this account

      ]
    ]
  }

  ngOnInit () {
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

  onSearch (event: Event) {
    this.onSearch(event)
    this.setQueryParams((event.target as HTMLInputElement).value)
  }

  setQueryParams (search: string) {
    const queryParams: Params = {}

    if (search) Object.assign(queryParams, { search })
    this.router.navigate([ '/admin/moderation/video-comments/list' ], { queryParams })
  }

  resetTableFilter () {
    this.setTableFilter('')
    this.setQueryParams('')
    this.resetSearch()
  }
  /* END Table filter functions */

  getIdentifier () {
    return 'VideoCommentListComponent'
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }

  protected loadData () {
    this.videoCommentService.getAdminVideoComments({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe(
        async resultList => {
          this.totalRecords = resultList.total

          this.comments = []

          for (const c of resultList.data) {
            this.comments.push(
              new VideoCommentAdmin(c, await this.toHtml(c.text))
            )
          }
        },

        err => this.notifier.error(err.message)
      )
  }
}
