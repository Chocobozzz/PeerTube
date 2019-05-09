import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { AuthService, Notifier } from '@app/core'
import { forkJoin } from 'rxjs'
import { Video, VideoPlaylistCreate, VideoPlaylistElementCreate, VideoPlaylistPrivacy } from '@shared/models'
import { FormReactive, FormValidatorService, VideoPlaylistValidatorsService } from '@app/shared/forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { secondsToTime } from '../../../assets/player/utils'

type PlaylistSummary = {
  id: number
  inPlaylist: boolean
  displayName: string

  startTimestamp?: number
  stopTimestamp?: number
}

@Component({
  selector: 'my-video-add-to-playlist',
  styleUrls: [ './video-add-to-playlist.component.scss' ],
  templateUrl: './video-add-to-playlist.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoAddToPlaylistComponent extends FormReactive implements OnInit {
  @Input() video: Video
  @Input() currentVideoTimestamp: number
  @Input() lazyLoad = false

  isNewPlaylistBlockOpened = false
  videoPlaylists: PlaylistSummary[] = []
  timestampOptions: {
    startTimestampEnabled: boolean
    startTimestamp: number
    stopTimestampEnabled: boolean
    stopTimestamp: number
  }
  displayOptions = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private i18n: I18n,
    private videoPlaylistService: VideoPlaylistService,
    private videoPlaylistValidatorsService: VideoPlaylistValidatorsService,
    private cd: ChangeDetectorRef
  ) {
    super()
  }

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.resetOptions(true)

    this.buildForm({
      displayName: this.videoPlaylistValidatorsService.VIDEO_PLAYLIST_DISPLAY_NAME
    })

    if (this.lazyLoad !== true) this.load()
  }

  load () {
    forkJoin([
      this.videoPlaylistService.listAccountPlaylists(this.user.account, '-updatedAt'),
      this.videoPlaylistService.doesVideoExistInPlaylist(this.video.id)
    ])
      .subscribe(
        ([ playlistsResult, existResult ]) => {
          for (const playlist of playlistsResult.data) {
            const existingPlaylist = existResult[ this.video.id ].find(p => p.playlistId === playlist.id)

            this.videoPlaylists.push({
              id: playlist.id,
              displayName: playlist.displayName,
              inPlaylist: !!existingPlaylist,
              startTimestamp: existingPlaylist ? existingPlaylist.startTimestamp : undefined,
              stopTimestamp: existingPlaylist ? existingPlaylist.stopTimestamp : undefined
            })
          }

          this.cd.markForCheck()
        }
      )
  }

  openChange (opened: boolean) {
    if (opened === false) {
      this.isNewPlaylistBlockOpened = false
      this.displayOptions = false
    }
  }

  openCreateBlock (event: Event) {
    event.preventDefault()

    this.isNewPlaylistBlockOpened = true
  }

  togglePlaylist (event: Event, playlist: PlaylistSummary) {
    event.preventDefault()

    if (playlist.inPlaylist === true) {
      this.removeVideoFromPlaylist(playlist)
    } else {
      this.addVideoInPlaylist(playlist)
    }

    playlist.inPlaylist = !playlist.inPlaylist
    this.resetOptions()

    this.cd.markForCheck()
  }

  createPlaylist () {
    const displayName = this.form.value[ 'displayName' ]

    const videoPlaylistCreate: VideoPlaylistCreate = {
      displayName,
      privacy: VideoPlaylistPrivacy.PRIVATE
    }

    this.videoPlaylistService.createVideoPlaylist(videoPlaylistCreate).subscribe(
      res => {
        this.videoPlaylists.push({
          id: res.videoPlaylist.id,
          displayName,
          inPlaylist: false
        })

        this.isNewPlaylistBlockOpened = false

        this.cd.markForCheck()
      },

      err => this.notifier.error(err.message)
    )
  }

  resetOptions (resetTimestamp = false) {
    this.displayOptions = false

    this.timestampOptions = {} as any
    this.timestampOptions.startTimestampEnabled = false
    this.timestampOptions.stopTimestampEnabled = false

    if (resetTimestamp) {
      this.timestampOptions.startTimestamp = 0
      this.timestampOptions.stopTimestamp = this.video.duration
    }
  }

  formatTimestamp (playlist: PlaylistSummary) {
    const start = playlist.startTimestamp ? secondsToTime(playlist.startTimestamp) : ''
    const stop = playlist.stopTimestamp ? secondsToTime(playlist.stopTimestamp) : ''

    return `(${start}-${stop})`
  }

  private removeVideoFromPlaylist (playlist: PlaylistSummary) {
    this.videoPlaylistService.removeVideoFromPlaylist(playlist.id, this.video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video removed from {{name}}', { name: playlist.displayName }))

            playlist.inPlaylist = false
          },

          err => {
            this.notifier.error(err.message)

            playlist.inPlaylist = true
          },

          () => this.cd.markForCheck()
        )
  }

  private addVideoInPlaylist (playlist: PlaylistSummary) {
    const body: VideoPlaylistElementCreate = { videoId: this.video.id }

    if (this.timestampOptions.startTimestampEnabled) body.startTimestamp = this.timestampOptions.startTimestamp
    if (this.timestampOptions.stopTimestampEnabled) body.stopTimestamp = this.timestampOptions.stopTimestamp

    this.videoPlaylistService.addVideoInPlaylist(playlist.id, body)
      .subscribe(
        () => {
          playlist.inPlaylist = true

          playlist.startTimestamp = body.startTimestamp
          playlist.stopTimestamp = body.stopTimestamp

          const message = body.startTimestamp || body.stopTimestamp
            ? this.i18n('Video added in {{n}} at timestamps {{t}}', { n: playlist.displayName, t: this.formatTimestamp(playlist) })
            : this.i18n('Video added in {{n}}', { n: playlist.displayName })

          this.notifier.success(message)
        },

        err => {
          this.notifier.error(err.message)

          playlist.inPlaylist = false
        },

        () => this.cd.markForCheck()
      )
  }
}
