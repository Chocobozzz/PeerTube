import { Component } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ActivatedRoute, Router } from '@angular/router'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { AuthService, Notifier, ServerService } from '@app/core'
import { VideoBlacklistService } from '@app/shared'
import { immutableAssign } from '@app/shared/misc/utils'
import { ScreenService } from '@app/shared/misc/screen.service'
import { MiniatureDisplayOptions } from '@app/shared/video/video-miniature.component'
import { SelectionType } from '@app/shared/video/videos-selection.component'
import { Video } from '@app/shared/video/video.model'

@Component({
  selector: 'my-video-auto-blacklist-list',
  templateUrl: './video-auto-blacklist-list.component.html',
  styleUrls: [ './video-auto-blacklist-list.component.scss' ]
})
export class VideoAutoBlacklistListComponent {
  titlePage: string
  selection: SelectionType = {}
  miniatureDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: false,
    by: true,
    privacyLabel: false,
    privacyText: true,
    state: false,
    blacklistInfo: false,
    nsfw: true
  }
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }
  videos: Video[] = []
  getVideosObservableFunction = this.getVideosObservable.bind(this)

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected screenService: ScreenService,
    protected serverService: ServerService,
    private i18n: I18n,
    private videoBlacklistService: VideoBlacklistService
  ) {
    this.titlePage = this.i18n('Auto-blacklisted videos')
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.videoBlacklistService.getAutoBlacklistedAsVideoList(newPagination)
  }

  removeVideoFromBlacklist (entry: Video) {
    this.videoBlacklistService.removeVideoFromBlacklist(entry.id).subscribe(
      () => {
        this.notifier.success(this.i18n('Video {{name}} removed from blacklist.', { name: entry.name }))

        this.videos = this.videos.filter(v => v.id !== entry.id)
      },

      error => this.notifier.error(error.message)
    )
  }

  removeSelectedVideosFromBlacklist () {
    const toReleaseVideosIds = Object.keys(this.selection)
                                      .filter(k => this.selection[ k ] === true)
                                      .map(k => parseInt(k, 10))

    this.videoBlacklistService.removeVideoFromBlacklist(toReleaseVideosIds).subscribe(
      () => {
        this.notifier.success(this.i18n('{{num}} videos removed from blacklist.', { num: toReleaseVideosIds.length }))

        this.selection = {}
        this.videos = this.videos.filter(v => toReleaseVideosIds.includes(v.id) === false)
      },

      error => this.notifier.error(error.message)
    )
  }
}
