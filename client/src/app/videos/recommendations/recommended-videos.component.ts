import { Component, Input, Output, OnChanges, EventEmitter } from '@angular/core'
import { Observable } from 'rxjs'
import { Video } from '@app/shared/video/video.model'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { RecommendationInfo } from '@app/shared/video/recommendation-info.model'
import { RecommendedVideosStore } from '@app/videos/recommendations/recommended-videos.store'
import { User } from '@app/shared'
import { AuthService, Notifier } from '@app/core'
import { UserService } from '@app/shared/users/user.service'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'

@Component({
  selector: 'my-recommended-videos',
  templateUrl: './recommended-videos.component.html',
  styleUrls: [ './recommended-videos.component.scss' ]
})
export class RecommendedVideosComponent implements OnChanges {
  static LOCAL_STORAGE_AUTO_PLAY_NEXT_VIDEO = 'auto_play_next_video'

  @Input() inputRecommendation: RecommendationInfo
  @Input() user: User
  @Input() playlist: VideoPlaylist
  @Output() gotRecommendations = new EventEmitter<Video[]>()

  readonly hasVideos$: Observable<boolean>
  readonly videos$: Observable<Video[]>

  private autoPlayNextVideo: boolean

  constructor (
    private userService: UserService,
    private authService: AuthService,
    private notifier: Notifier,
    private store: RecommendedVideosStore
  ) {
    this.videos$ = this.store.recommendations$
    this.hasVideos$ = this.store.hasRecommendations$
    this.videos$.subscribe(videos => this.gotRecommendations.emit(videos))

    this.autoPlayNextVideo = this.authService.isLoggedIn()
      ? this.authService.getUser().autoPlayNextVideo
      : peertubeLocalStorage.getItem(RecommendedVideosComponent.LOCAL_STORAGE_AUTO_PLAY_NEXT_VIDEO) === 'true' || false
  }

  public ngOnChanges (): void {
    if (this.inputRecommendation) {
      this.store.requestNewRecommendations(this.inputRecommendation)
    }
  }

  onVideoRemoved () {
    this.store.requestNewRecommendations(this.inputRecommendation)
  }

  switchAutoPlayNextVideo () {
    peertubeLocalStorage.setItem(RecommendedVideosComponent.LOCAL_STORAGE_AUTO_PLAY_NEXT_VIDEO, this.autoPlayNextVideo.toString())

    if (this.authService.isLoggedIn()) {
      const details = {
        autoPlayNextVideo: this.autoPlayNextVideo
      }

      this.userService.updateMyProfile(details).subscribe(
        () => {
          this.authService.refreshUserInformation()
        },
        err => this.notifier.error(err.message)
      )
    }
  }
}
