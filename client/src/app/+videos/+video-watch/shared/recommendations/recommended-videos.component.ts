import { Observable, startWith, Subscription, switchMap } from 'rxjs'
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core'
import { AuthService, Notifier, User, UserService } from '@app/core'
import { Video } from '@app/shared/shared-main/video/video.model'
import { RecommendationInfo } from './recommendation-info.model'
import { RecommendedVideosStore } from './recommended-videos.store'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from '../../../../shared/shared-video-miniature/video-miniature.component'
import { FormsModule } from '@angular/forms'
import { InputSwitchComponent } from '../../../../shared/shared-forms/input-switch.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { NgClass, NgIf, NgFor, AsyncPipe } from '@angular/common'
import { VideoPlaylist } from '@peertube/peertube-models'

@Component({
  selector: 'my-recommended-videos',
  templateUrl: './recommended-videos.component.html',
  styleUrls: [ './recommended-videos.component.scss' ],
  standalone: true,
  imports: [ NgClass, NgIf, NgbTooltip, InputSwitchComponent, FormsModule, NgFor, VideoMiniatureComponent, AsyncPipe ]
})
export class RecommendedVideosComponent implements OnInit, OnChanges, OnDestroy {
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

  user: User

  private userSub: Subscription

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
    if (this.inputRecommendation) {
      this.store.requestNewRecommendations(this.inputRecommendation)
    }
  }

  ngOnDestroy () {
    if (this.userSub) this.userSub.unsubscribe()
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
