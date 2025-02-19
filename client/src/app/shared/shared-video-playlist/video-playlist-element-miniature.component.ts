import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, input, output, viewChild } from '@angular/core'
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
  imports: [
    NgClass,
    RouterLink,
    NgIf,
    GlobalIconComponent,
    VideoThumbnailComponent,
    DateToggleComponent,
    VideoViewsCounterComponent,
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
  private authService = inject(AuthService)
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)
  private videoPlaylistService = inject(VideoPlaylistService)
  private videoService = inject(VideoService)
  private cdr = inject(ChangeDetectorRef)

  readonly moreDropdown = viewChild<NgbDropdown>('moreDropdown')

  readonly playlist = input<VideoPlaylist>(undefined)
  readonly playlistElement = input<VideoPlaylistElement>(undefined)
  readonly owned = input(false)
  readonly playing = input(false)
  readonly rowLink = input(false)
  readonly accountLink = input(true)
  readonly position = input<number // Keep this property because we're in the OnPush change detection strategy
  >(undefined) // Keep this property because we're in the OnPush change detection strategy

  readonly elementRemoved = output<VideoPlaylistElement>()

  displayTimestampOptions = false

  timestampOptions: {
    startTimestampEnabled: boolean
    startTimestamp: number
    stopTimestampEnabled: boolean
    stopTimestamp: number
  } = {} as any

  private serverConfig: HTMLServerConfig

  ngOnInit (): void {
    this.serverConfig = this.serverService.getHTMLConfig()
  }

  getVideoAriaLabel () {
    return $localize`Watch video ${this.playlistElement().video.name}`
  }

  getVideoOwnerDisplayType (element: VideoPlaylistElement) {
    return this.videoService.buildDefaultOwnerDisplayType(element.video)
  }

  isVideoPrivate () {
    return this.playlistElement().video.privacy.id === VideoPrivacy.PRIVATE
  }

  isVideoPasswordProtected () {
    return this.playlistElement().video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED
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
    const playlist = this.playlist()
    if (!playlist) return null

    return VideoPlaylist.buildWatchUrl(playlist)
  }

  buildRouterQuery () {
    const playlistElement = this.playlistElement()
    if (!playlistElement?.video) return {}

    return {
      playlistPosition: playlistElement.position,
      start: playlistElement.startTimestamp,
      stop: playlistElement.stopTimestamp,
      resume: true
    }
  }

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.authService.getUser(), this.serverConfig)
  }

  removeFromPlaylist (playlistElement: VideoPlaylistElement) {
    const playlistElementValue = this.playlistElement()
    const videoId = playlistElementValue.video ? playlistElementValue.video.id : undefined

    this.videoPlaylistService.removeVideoFromPlaylist(this.playlist().id, playlistElement.id, videoId)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Video removed from ${this.playlist().displayName}`)
          this.elementRemoved.emit(playlistElement)
        },

        error: err => this.notifier.error(err.message)
      })

    this.moreDropdown().close()
  }

  updateTimestamps (playlistElement: VideoPlaylistElement) {
    const body: VideoPlaylistElementUpdate = {}

    body.startTimestamp = this.timestampOptions.startTimestampEnabled ? this.timestampOptions.startTimestamp : null
    body.stopTimestamp = this.timestampOptions.stopTimestampEnabled ? this.timestampOptions.stopTimestamp : null

    this.videoPlaylistService.updateVideoOfPlaylist(this.playlist().id, playlistElement.id, body, this.playlistElement().video.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Timestamps updated`)

          playlistElement.startTimestamp = body.startTimestamp
          playlistElement.stopTimestamp = body.stopTimestamp

          this.cdr.detectChanges()
        },

        error: err => this.notifier.error(err.message)
      })

    this.moreDropdown().close()
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
