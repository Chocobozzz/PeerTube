import { Observable } from 'rxjs'
import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core'
import { AuthService, Notifier, SessionStorageService, User, UserService } from '@app/core'
import { Video } from '@app/shared/shared-main'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature'
import { VideoPlaylist } from '@app/shared/shared-video-playlist'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RecommendationInfo } from './recommendation-info.model'
import { RecommendedVideosStore } from './recommended-videos.store'
import { UserLocalStorageKeys } from '@root-helpers/users'

@Component({
  selector: 'my-recommended-videos',
  templateUrl: './recommended-videos.component.html',
  styleUrls: [ './recommended-videos.component.scss' ]
})
export class RecommendedVideosComponent implements OnInit, OnChanges {
  @Input() inputRecommendation: RecommendationInfo
  @Input() playlist: VideoPlaylist
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
    private i18n: I18n,
    private store: RecommendedVideosStore,
    private sessionStorageService: SessionStorageService
  ) {
    this.videos$ = this.store.recommendations$
    this.hasVideos$ = this.store.hasRecommendations$
    this.videos$.subscribe(videos => this.gotRecommendations.emit(videos))

    if (this.authService.isLoggedIn()) {
      this.autoPlayNextVideo = this.authService.getUser().autoPlayNextVideo
    } else {
      this.autoPlayNextVideo = this.sessionStorageService.getItem(UserLocalStorageKeys.SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO) === 'true'

      this.sessionStorageService.watch([UserLocalStorageKeys.SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO]).subscribe(
        () => {
          this.autoPlayNextVideo = this.sessionStorageService.getItem(UserLocalStorageKeys.SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO) === 'true'
        }
      )
    }

    this.autoPlayNextVideoTooltip = this.i18n('When active, the next video is automatically played after the current one.')
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
    this.sessionStorageService.setItem(UserLocalStorageKeys.SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO, this.autoPlayNextVideo.toString())

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
