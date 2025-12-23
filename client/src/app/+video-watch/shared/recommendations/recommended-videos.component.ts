import { NgClass } from '@angular/common'
import { Component, OnChanges, OnDestroy, OnInit, inject, input, output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AuthService, Notifier, User, UserService } from '@app/core'
import { InputSwitchComponent } from '@app/shared/shared-forms/input-switch.component'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { Video } from '@app/shared/shared-main/video/video.model'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from '@app/shared/shared-video-miniature/video-miniature.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { VideoPlaylist } from '@peertube/peertube-models'
import { Subscription, startWith, switchMap } from 'rxjs'
import { VideoRecommendationService } from './video-recommendation.service'

@Component({
  selector: 'my-recommended-videos',
  templateUrl: './recommended-videos.component.html',
  styleUrls: [ './recommended-videos.component.scss' ],
  imports: [ NgClass, NgbTooltip, InputSwitchComponent, FormsModule, VideoMiniatureComponent ]
})
export class RecommendedVideosComponent implements OnInit, OnChanges, OnDestroy {
  private userService = inject(UserService)
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private videoRecommendation = inject(VideoRecommendationService)

  readonly currentVideo = input<VideoDetails>(undefined)
  readonly playlist = input<VideoPlaylist>(undefined)
  readonly displayAsRow = input<boolean>(undefined)

  readonly gotRecommendations = output<Video[]>()

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

  constructor () {
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
    if (this.currentVideo()) {
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

          error: err => this.notifier.handleError(err)
        })
    } else {
      this.userService.updateMyAnonymousProfile(details)
    }
  }

  private loadRecommendations () {
    this.videoRecommendation.getRecommendations(this.currentVideo(), this.videoRecommendation.getRecommendationHistory())
      .subscribe({
        next: videos => {
          this.videos = videos

          this.gotRecommendations.emit(this.videos)
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
