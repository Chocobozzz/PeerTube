import { Component, OnInit, OnDestroy } from '@angular/core'
import { Location } from '@angular/common'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Router, ActivatedRoute } from '@angular/router'

import { AbstractVideoList } from '@app/shared/video/abstract-video-list'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Notifier, AuthService } from '@app/core'
import { VideoService } from '@app/shared/video/video.service'
import { Video } from '../../../../../../shared'
import { immutableAssign } from '@app/shared/misc/utils'
import { VideoSortField } from '@app/shared/video/sort-field.type'
import { ScreenService } from '@app/shared/misc/screen.service'

@Component({
  selector: 'my-video-quarantine-list',
  templateUrl: './video-quarantine-list.component.html',
  styleUrls: [ './video-quarantine-list.component.scss' ]
})
export class VideoQuarantineListComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  currentRoute = '/admin/moderation/video-quarantine/list'
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
    private videoService: VideoService
  ) {
    super()

    this.titlePage = this.i18n('Quarantined videos')
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

    return this.videoService.getQuarantinedVideos(newPagination, this.sort)
  }

  generateSyndicationList () {
    throw new Error('Method not implemented.')
  }

  releaseVideoFromQuarantine (entry: Video) {
    this.videoService.releaseQuarantinedVideos(entry.id).subscribe(
      () => {
        this.notifier.success(this.i18n('Video {{name}} released from quarantine.', { name: entry.name }))
        this.reloadVideos()
      },

      error => this.notifier.error(error.message)
    )
  }

  releaseSelectedVideosFromQuarantine () {
    const toReleaseVideosIds = Object.keys(this.checkedVideos)
                                      .filter(k => this.checkedVideos[ k ] === true)
                                      .map(k => parseInt(k, 10))

    this.videoService.releaseQuarantinedVideos(toReleaseVideosIds).subscribe(
      () => {
        this.notifier.success(this.i18n('{{num}} videos released from quarantine.', { num: toReleaseVideosIds.length }))

        this.abortSelectionMode()
        this.reloadVideos()
      },

      error => this.notifier.error(error.message)
    )
  }

}
