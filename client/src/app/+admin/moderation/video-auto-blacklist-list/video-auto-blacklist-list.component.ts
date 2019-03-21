import { Component, OnInit, OnDestroy } from '@angular/core'
import { Location } from '@angular/common'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Router, ActivatedRoute } from '@angular/router'
import { AbstractVideoList } from '@app/shared/video/abstract-video-list'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Notifier, AuthService, ServerService } from '@app/core'
import { Video } from '@shared/models'
import { VideoBlacklistService } from '@app/shared'
import { immutableAssign } from '@app/shared/misc/utils'
import { ScreenService } from '@app/shared/misc/screen.service'

@Component({
  selector: 'my-video-auto-blacklist-list',
  templateUrl: './video-auto-blacklist-list.component.html',
  styleUrls: [ './video-auto-blacklist-list.component.scss' ]
})
export class VideoAutoBlacklistListComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  checkedVideos: { [ id: number ]: boolean } = {}
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }

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
    super()

    this.titlePage = this.i18n('Auto-blacklisted videos')
  }

  ngOnInit () {
    super.ngOnInit()
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  abortSelectionMode () {
    this.checkedVideos = {}
  }

  isInSelectionMode () {
    return Object.keys(this.checkedVideos).some(k => this.checkedVideos[k] === true)
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.videoBlacklistService.getAutoBlacklistedAsVideoList(newPagination)
  }

  generateSyndicationList () {
    throw new Error('Method not implemented.')
  }

  removeVideoFromBlacklist (entry: Video) {
    this.videoBlacklistService.removeVideoFromBlacklist(entry.id).subscribe(
      () => {
        this.notifier.success(this.i18n('Video {{name}} removed from blacklist.', { name: entry.name }))
        this.reloadVideos()
      },

      error => this.notifier.error(error.message)
    )
  }

  removeSelectedVideosFromBlacklist () {
    const toReleaseVideosIds = Object.keys(this.checkedVideos)
                                      .filter(k => this.checkedVideos[ k ] === true)
                                      .map(k => parseInt(k, 10))

    this.videoBlacklistService.removeVideoFromBlacklist(toReleaseVideosIds).subscribe(
      () => {
        this.notifier.success(this.i18n('{{num}} videos removed from blacklist.', { num: toReleaseVideosIds.length }))

        this.abortSelectionMode()
        this.reloadVideos()
      },

      error => this.notifier.error(error.message)
    )
  }
}
