import { from as observableFrom, Observable } from 'rxjs'
import { concatAll, tap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { immutableAssign } from '@app/shared/misc/utils'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { Video } from '../../shared/video/video.model'
import { VideoService } from '../../shared/video/video.service'

@Component({
  selector: 'my-account-videos',
  templateUrl: './my-account-videos.component.html',
  styleUrls: [ './my-account-videos.component.scss' ]
})
export class MyAccountVideosComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage = 'My videos'
  currentRoute = '/my-account/videos'
  checkedVideos: { [ id: number ]: boolean } = {}
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }

  protected baseVideoWidth = -1
  protected baseVideoHeight = 155

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected authService: AuthService,
               protected notificationsService: NotificationsService,
               protected confirmService: ConfirmService,
               protected location: Location,
               private videoService: VideoService) {
    super()
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

    return this.videoService.getMyVideos(newPagination, this.sort)
  }

  generateSyndicationList () {
    throw new Error('Method not implemented.')
  }

  async deleteSelectedVideos () {
    const toDeleteVideosIds = Object.keys(this.checkedVideos)
      .filter(k => this.checkedVideos[k] === true)
      .map(k => parseInt(k, 10))

    const res = await this.confirmService.confirm(`Do you really want to delete ${toDeleteVideosIds.length} videos?`, 'Delete')
    if (res === false) return

    const observables: Observable<any>[] = []
    for (const videoId of toDeleteVideosIds) {
      const o = this.videoService
                    .removeVideo(videoId)
                    .pipe(tap(() => this.spliceVideosById(videoId)))

      observables.push(o)
    }

    observableFrom(observables).pipe(
      concatAll())
      .subscribe(
        res => {
          this.notificationsService.success('Success', `${toDeleteVideosIds.length} videos deleted.`)
          this.buildVideoPages()
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  async deleteVideo (video: Video) {
    const res = await this.confirmService.confirm(`Do you really want to delete ${video.name}?`, 'Delete')
    if (res === false) return

    this.videoService.removeVideo(video.id)
      .subscribe(
        status => {
          this.notificationsService.success('Success', `Video ${video.name} deleted.`)
          this.spliceVideosById(video.id)
          this.buildVideoPages()
        },

        error => this.notificationsService.error('Error', error.message)
      )
  }

  protected buildVideoHeight () {
    // In account videos, the video height is fixed
    return this.baseVideoHeight
  }

  private spliceVideosById (id: number) {
    for (const key of Object.keys(this.loadedPages)) {
      const videos = this.loadedPages[key]
      const index = videos.findIndex(v => v.id === id)

      if (index !== -1) {
        videos.splice(index, 1)
        return
      }
    }
  }
}
