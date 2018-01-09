import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import 'rxjs/add/observable/from'
import 'rxjs/add/operator/concatAll'
import { Observable } from 'rxjs/Observable'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { Video } from '../../shared/video/video.model'
import { VideoService } from '../../shared/video/video.service'

@Component({
  selector: 'my-account-videos',
  templateUrl: './account-videos.component.html',
  styleUrls: [ './account-videos.component.scss' ]
})
export class AccountVideosComponent extends AbstractVideoList implements OnInit {
  titlePage = 'My videos'
  currentRoute = '/account/videos'
  checkedVideos: { [ id: number ]: boolean } = {}
  pagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected authService: AuthService,
               protected notificationsService: NotificationsService,
               protected confirmService: ConfirmService,
               private videoService: VideoService) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  abortSelectionMode () {
    this.checkedVideos = {}
  }

  isInSelectionMode () {
    return Object.keys(this.checkedVideos).some(k => this.checkedVideos[k] === true)
  }

  getVideosObservable () {
    return this.videoService.getMyVideos(this.pagination, this.sort)
  }

  deleteSelectedVideos () {
    const toDeleteVideosIds = Object.keys(this.checkedVideos)
      .filter(k => this.checkedVideos[k] === true)
      .map(k => parseInt(k, 10))

    this.confirmService.confirm(`Do you really want to delete ${toDeleteVideosIds.length} videos?`, 'Delete').subscribe(
      res => {
        if (res === false) return

        const observables: Observable<any>[] = []
        for (const videoId of toDeleteVideosIds) {
          const o = this.videoService
            .removeVideo(videoId)
            .do(() => this.spliceVideosById(videoId))

          observables.push(o)
        }

        Observable.from(observables)
          .concatAll()
          .subscribe(
            res => this.notificationsService.success('Success', `${toDeleteVideosIds.length} videos deleted.`),

          err => this.notificationsService.error('Error', err.message)
          )
      }
    )
  }

  deleteVideo (video: Video) {
    this.confirmService.confirm(`Do you really want to delete ${video.name}?`, 'Delete').subscribe(
      res => {
        if (res === false) return

        this.videoService.removeVideo(video.id)
          .subscribe(
            status => {
              this.notificationsService.success('Success', `Video ${video.name} deleted.`)
              this.spliceVideosById(video.id)
            },

            error => this.notificationsService.error('Error', error.message)
          )
      }
    )
  }

  private spliceVideosById (id: number) {
    const index = this.videos.findIndex(v => v.id === id)
    this.videos.splice(index, 1)
  }
}
