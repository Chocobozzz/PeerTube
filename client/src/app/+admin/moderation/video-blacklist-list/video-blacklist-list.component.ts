import { Component, OnInit } from '@angular/core'
import { SortMeta } from 'primeng/api'
import { Notifier, ServerService } from '@app/core'
import { ConfirmService } from '../../../core'
import { RestPagination, RestTable, VideoBlacklistService } from '../../../shared'
import { VideoBlacklist, VideoBlacklistType } from '../../../../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { DropdownAction } from '../../../shared/buttons/action-dropdown.component'
import { Video } from '../../../shared/video/video.model'
import { MarkdownService } from '@app/shared/renderer'

@Component({
  selector: 'my-video-blacklist-list',
  templateUrl: './video-blacklist-list.component.html',
  styleUrls: [ '../moderation.component.scss' ]
})
export class VideoBlacklistListComponent extends RestTable implements OnInit {
  blacklist: (VideoBlacklist & { reasonHtml?: string })[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }
  listBlacklistTypeFilter: VideoBlacklistType = undefined

  videoBlacklistActions: DropdownAction<VideoBlacklist>[] = []

  constructor (
    private notifier: Notifier,
    private serverService: ServerService,
    private confirmService: ConfirmService,
    private videoBlacklistService: VideoBlacklistService,
    private markdownRenderer: MarkdownService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.serverService.getConfig()
        .subscribe(config => {
          // don't filter if auto-blacklist is not enabled as this will be the only list
          if (config.autoBlacklist.videos.ofUsers.enabled) {
            this.listBlacklistTypeFilter = VideoBlacklistType.MANUAL
          }
        })

    this.initialize()

    this.videoBlacklistActions = [
      {
        label: this.i18n('Unblacklist'),
        handler: videoBlacklist => this.removeVideoFromBlacklist(videoBlacklist)
      }
    ]
  }

  getIdentifier () {
    return 'VideoBlacklistListComponent'
  }

  getVideoUrl (videoBlacklist: VideoBlacklist) {
    return Video.buildClientUrl(videoBlacklist.video.uuid)
  }

  booleanToText (value: boolean) {
    if (value === true) return this.i18n('yes')

    return this.i18n('no')
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }

  async removeVideoFromBlacklist (entry: VideoBlacklist) {
    const confirmMessage = this.i18n(
      'Do you really want to remove this video from the blacklist? It will be available again in the videos list.'
    )

    const res = await this.confirmService.confirm(confirmMessage, this.i18n('Unblacklist'))
    if (res === false) return

    this.videoBlacklistService.removeVideoFromBlacklist(entry.video.id).subscribe(
      () => {
        this.notifier.success(this.i18n('Video {{name}} removed from the blacklist.', { name: entry.video.name }))
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  protected loadData () {
    this.videoBlacklistService.listBlacklist({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search,
      type: this.listBlacklistTypeFilter
    })
      .subscribe(
        async resultList => {
          this.totalRecords = resultList.total

          this.blacklist = resultList.data

          for (const element of this.blacklist) {
            Object.assign(element, { reasonHtml: await this.toHtml(element.reason) })
          }
        },

        err => this.notifier.error(err.message)
      )
  }
}
