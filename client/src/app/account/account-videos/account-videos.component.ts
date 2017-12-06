import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
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

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected notificationsService: NotificationsService,
               protected confirmService: ConfirmService,
               private videoService: VideoService) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  getVideosObservable () {
    return this.videoService.getMyVideos(this.pagination, this.sort)
  }

  deleteVideo (video: Video) {
    this.confirmService.confirm(`Do you really want to delete ${video.name}?`, 'Delete').subscribe(
      res => {
        if (res === false) return

        this.videoService.removeVideo(video.id)
          .subscribe(
            status => {
              this.notificationsService.success('Success', `Video ${video.name} deleted.`)
              const index = this.videos.findIndex(v => v.id === video.id)
              this.videos.splice(index, 1)
            },

            error => this.notificationsService.error('Error', error.text)
          )
      }
    )
  }
}
