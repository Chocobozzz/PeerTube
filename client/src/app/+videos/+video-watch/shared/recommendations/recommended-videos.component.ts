import { AsyncPipe, NgClass, NgFor, NgIf } from '@angular/common'
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AuthService, Notifier, User, UserService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { Video } from '@app/shared/shared-main/video/video.model'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { VideoPlaylist } from '@peertube/peertube-models'
import { Subscription, startWith, switchMap } from 'rxjs'
import { InputSwitchComponent } from '../../../../shared/shared-forms/input-switch.component'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from '../../../../shared/shared-video-miniature/video-miniature.component'
import { VideoRecommendationService } from './video-recommendation.service'

@Component({
  selector: 'my-recommended-videos',
  templateUrl: './recommended-videos.component.html',
  styleUrls: [ './recommended-videos.component.scss' ],
  standalone: true,
  imports: [ NgClass, NgIf, NgbTooltip, InputSwitchComponent, FormsModule, NgFor, VideoMiniatureComponent, AsyncPipe ]
})
export class RecommendedVideosComponent implements OnInit, OnChanges, OnDestroy {
  @Input() currentVideo: VideoDetails
  @Input() playlist: VideoPlaylist
  @Input() displayAsRow: boolean

  @Output() gotRecommendations = new EventEmitter<Video[]>()

  videos: Video[] = []

  autoPlayNextVideo: boolean
  autoPlayNextVideoTooltip: string

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true
  }

  user: User

  private userSub: Subscription

  constructor (
    private userService: UserService,
    private authService: AuthService,
    private notifier: Notifier,
    private videoRecommendation: VideoRecommendationService
  ) {
    this.autoPlayNextVideoTooltip = $localize`When active, the next video is automatically played after the current one.`
  }

  ngOnInit () {
    this.userSub = this.userService.listenAnonymousUpdate()
      .pipe(
        startWith(true),
        switchMap(() => this.userService.getAnonymousOrLoggedUser())
      )
      .subscribe(user => {
        this.user = user
        this.autoPlayNextVideo = user.autoPlayNextVideo
      })
  }

  ngOnChanges () {
    if (this.currentVideo) {
      this.loadRecommendations()
    }
  }

  ngOnDestroy () {
    if (this.userSub) this.userSub.unsubscribe()
  }

  onVideoRemoved () {
    this.loadRecommendations()
  }

  switchAutoPlayNextVideo () {
    const details = { autoPlayNextVideo: this.autoPlayNextVideo }

    if (this.authService.isLoggedIn()) {
      this.userService.updateMyProfile(details)
        .subscribe({
          next: () => {
            this.authService.refreshUserInformation()
          },

          error: err => this.notifier.error(err.message)
        })
    } else {
      this.userService.updateMyAnonymousProfile(details)
    }
  }

  private loadRecommendations () {
    this.videoRecommendation.getRecommendations(this.currentVideo, this.videoRecommendation.getRecommentationHistory())
      .subscribe({
        next: videos => {
          this.videos = videos

          this.gotRecommendations.emit(this.videos)
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
