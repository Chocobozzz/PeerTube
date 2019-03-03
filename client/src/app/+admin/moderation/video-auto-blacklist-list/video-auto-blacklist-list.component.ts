import { Component, OnInit, OnDestroy } from '@angular/core'
import { Location } from '@angular/common'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Router, ActivatedRoute } from '@angular/router'

import { AbstractVideoList } from '@app/shared/video/abstract-video-list'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Notifier, AuthService } from '@app/core'
import { Video } from '../../../../../../shared'
import { VideoBlacklistService } from '@app/shared'
import { immutableAssign } from '@app/shared/misc/utils'
import { VideoService } from '@app/shared/video/video.service'
import { VideoSortField } from '@app/shared/video/sort-field.type'
import { ScreenService } from '@app/shared/misc/screen.service'

@Component({
  selector: 'my-video-auto-blacklist-list',
  templateUrl: './video-auto-blacklist-list.component.html',
  styleUrls: [ './video-auto-blacklist-list.component.scss' ]
})
export class VideoAutoBlacklistListComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  currentRoute = '/admin/moderation/video-auto-blacklist/list'
  defaultSort: VideoSortField = 'publishedAt' // prioritize first "published" (to moderators) since waiting longest
  checkedVideos: { [ id: number ]: boolean } = {}
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }

  protected baseVideoWidth = -1
  protected baseVideoHeight = 155

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    protected i18n: I18n,
    protected notifier: Notifier,
    protected location: Location,
    protected authService: AuthService,
    protected screenService: ScreenService,
    private videoBlacklistService: VideoBlacklistService,
    private videoService: VideoService
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

    return this.videoService.getVideos(newPagination, this.sort)
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
