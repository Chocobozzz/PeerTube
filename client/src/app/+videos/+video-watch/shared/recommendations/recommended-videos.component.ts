import { Observable } from 'rxjs'
import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core'
import { AuthService, Notifier, User, UserService } from '@app/core'
import { Video } from '@app/shared/shared-main'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature'
import { VideoPlaylist } from '@app/shared/shared-video-playlist'
import { RecommendationInfo } from './recommendation-info.model'
import { RecommendedVideosStore } from './recommended-videos.store'

@Component({
  selector: 'my-recommended-videos',
  templateUrl: './recommended-videos.component.html',
  styleUrls: [ './recommended-videos.component.scss' ]
})
export class RecommendedVideosComponent implements OnInit, OnChanges {
  @Input() inputRecommendation: RecommendationInfo
  @Input() playlist: VideoPlaylist
  @Input() displayAsRow: boolean

  @Output() gotRecommendations = new EventEmitter<Video[]>()

  autoPlayNextVideo: boolean
  autoPlayNextVideoTooltip: string

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true
  }

  userMiniature: User

  readonly hasVideos$: Observable<boolean>
  readonly videos$: Observable<Video[]>

  constructor (
    private userService: UserService,
    private authService: AuthService,
    private notifier: Notifier,
    private store: RecommendedVideosStore
  ) {
    this.videos$ = this.store.recommendations$
    this.hasVideos$ = this.store.hasRecommendations$
    this.videos$.subscribe(videos => this.gotRecommendations.emit(videos))

    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => this.autoPlayNextVideo = user.autoPlayNextVideo)

    this.autoPlayNextVideoTooltip = $localize`When active, the next video is automatically played after the current one.`
  }

  ngOnInit () {
    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => this.userMiniature = user)
  }

  ngOnChanges () {
    if (this.inputRecommendation) {
      this.store.requestNewRecommendations(this.inputRecommendation)
    }
  }

  onVideoRemoved () {
    this.store.requestNewRecommendations(this.inputRecommendation)
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
}
