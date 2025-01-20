import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, Notifier, ServerService } from '@app/core'
import { NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownButtonItem, NgbDropdownItem } from '@ng-bootstrap/ng-bootstrap'
import { secondsToTime } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, VideoPlaylistElementType, VideoPlaylistElementUpdate, VideoPrivacy } from '@peertube/peertube-models'
import { VideoPlaylistElement } from './video-playlist-element.model'
import { VideoPlaylist } from './video-playlist.model'
import { VideoPlaylistService } from './video-playlist.service'
import { TimestampInputComponent } from '../shared-forms/timestamp-input.component'
import { FormsModule } from '@angular/forms'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { EditButtonComponent } from '../shared-main/buttons/edit-button.component'
import { VideoViewsCounterComponent } from '../shared-video/video-views-counter.component'
import { DateToggleComponent } from '../shared-main/date/date-toggle.component'
import { VideoThumbnailComponent } from '../shared-thumbnail/video-thumbnail.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { RouterLink } from '@angular/router'
import { NgClass, NgIf } from '@angular/common'
import { Video } from '../shared-main/video/video.model'
import { VideoService } from '../shared-main/video/video.service'

@Component({
  selector: 'my-video-playlist-element-miniature',
  styleUrls: [ './video-playlist-element-miniature.component.scss' ],
  templateUrl: './video-playlist-element-miniature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgClass,
    RouterLink,
    NgIf,
    GlobalIconComponent,
    VideoThumbnailComponent,
    DateToggleComponent,
    VideoViewsCounterComponent,
    EditButtonComponent,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownButtonItem,
    NgbDropdownItem,
    PeertubeCheckboxComponent,
    FormsModule,
    TimestampInputComponent
  ]
})
export class VideoPlaylistElementMiniatureComponent implements OnInit {
  @ViewChild('moreDropdown') moreDropdown: NgbDropdown

  @Input() playlist: VideoPlaylist
  @Input() playlistElement: VideoPlaylistElement
  @Input() owned = false
  @Input() playing = false
  @Input() rowLink = false
  @Input() accountLink = true
  @Input() position: number // Keep this property because we're in the OnPush change detection strategy

  @Output() elementRemoved = new EventEmitter<VideoPlaylistElement>()

  displayTimestampOptions = false

  timestampOptions: {
    startTimestampEnabled: boolean
    startTimestamp: number
    stopTimestampEnabled: boolean
    stopTimestamp: number
  } = {} as any

  private serverConfig: HTMLServerConfig

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private notifier: Notifier,
    private videoPlaylistService: VideoPlaylistService,
    private videoService: VideoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit (): void {
    this.serverConfig = this.serverService.getHTMLConfig()
  }

  getVideoAriaLabel () {
    return $localize`Watch video ${this.playlistElement.video.name}`
  }

  getVideoOwnerDisplayType (element: VideoPlaylistElement) {
    return this.videoService.buildDefaultOwnerDisplayType(element.video)
  }

  isVideoPrivate () {
    return this.playlistElement.video.privacy.id === VideoPrivacy.PRIVATE
  }

  isVideoPasswordProtected () {
    return this.playlistElement.video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED
  }

  isUnavailable (e: VideoPlaylistElement) {
    return e.type === VideoPlaylistElementType.UNAVAILABLE
  }

  isPrivate (e: VideoPlaylistElement) {
    return e.type === VideoPlaylistElementType.PRIVATE
  }

  isDeleted (e: VideoPlaylistElement) {
    return e.type === VideoPlaylistElementType.DELETED
  }

  buildRouterLink () {
    if (!this.playlist) return null

    return VideoPlaylist.buildWatchUrl(this.playlist)
  }

  buildRouterQuery () {
    if (!this.playlistElement?.video) return {}

    return {
      playlistPosition: this.playlistElement.position,
      start: this.playlistElement.startTimestamp,
      stop: this.playlistElement.stopTimestamp,
      resume: true
    }
  }

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.authService.getUser(), this.serverConfig)
  }

  removeFromPlaylist (playlistElement: VideoPlaylistElement) {
    const videoId = this.playlistElement.video ? this.playlistElement.video.id : undefined

    this.videoPlaylistService.removeVideoFromPlaylist(this.playlist.id, playlistElement.id, videoId)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Video removed from ${this.playlist.displayName}`)
            this.elementRemoved.emit(playlistElement)
          },

          error: err => this.notifier.error(err.message)
        })

    this.moreDropdown.close()
  }

  updateTimestamps (playlistElement: VideoPlaylistElement) {
    const body: VideoPlaylistElementUpdate = {}

    body.startTimestamp = this.timestampOptions.startTimestampEnabled ? this.timestampOptions.startTimestamp : null
    body.stopTimestamp = this.timestampOptions.stopTimestampEnabled ? this.timestampOptions.stopTimestamp : null

    this.videoPlaylistService.updateVideoOfPlaylist(this.playlist.id, playlistElement.id, body, this.playlistElement.video.id)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Timestamps updated`)

            playlistElement.startTimestamp = body.startTimestamp
            playlistElement.stopTimestamp = body.stopTimestamp

            this.cdr.detectChanges()
          },

          error: err => this.notifier.error(err.message)
        })

    this.moreDropdown.close()
  }

  formatTimestamp (playlistElement: VideoPlaylistElement) {
    const start = playlistElement.startTimestamp
    const stop = playlistElement.stopTimestamp

    const startFormatted = secondsToTime({ seconds: start, format: 'full', symbol: ':' })
    const stopFormatted = secondsToTime({ seconds: stop, format: 'full', symbol: ':' })

    if (start === null && stop === null) return ''

    if (start !== null && stop === null) return $localize`Starts at ` + startFormatted
    if (start === null && stop !== null) return $localize`Stops at ` + stopFormatted

    return $localize`Starts at ` + startFormatted + $localize` and stops at ` + stopFormatted
  }

  onDropdownOpenChange () {
    this.displayTimestampOptions = false
  }

  toggleDisplayTimestampsOptions (event: Event, playlistElement: VideoPlaylistElement) {
    event.preventDefault()

    this.displayTimestampOptions = !this.displayTimestampOptions

    if (this.displayTimestampOptions === true) {
      this.timestampOptions = {
        startTimestampEnabled: false,
        stopTimestampEnabled: false,
        startTimestamp: 0,
        stopTimestamp: playlistElement.video.duration
      }

      if (playlistElement.startTimestamp) {
        this.timestampOptions.startTimestampEnabled = true
        this.timestampOptions.startTimestamp = playlistElement.startTimestamp
      }

      if (playlistElement.stopTimestamp) {
        this.timestampOptions.stopTimestampEnabled = true
        this.timestampOptions.stopTimestamp = playlistElement.stopTimestamp
      }
    }

    this.cdr.markForCheck()
  }
}
