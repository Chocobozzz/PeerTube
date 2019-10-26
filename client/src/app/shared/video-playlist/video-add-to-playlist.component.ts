import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core'
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

  playlistElementId?: number
  startTimestamp?: number
  stopTimestamp?: number
}

@Component({
  selector: 'my-video-add-to-playlist',
  styleUrls: [ './video-add-to-playlist.component.scss' ],
  templateUrl: './video-add-to-playlist.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoAddToPlaylistComponent extends FormReactive implements OnInit, OnChanges {
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
    this.buildForm({
      displayName: this.videoPlaylistValidatorsService.VIDEO_PLAYLIST_DISPLAY_NAME
    })
  }

  ngOnChanges (simpleChanges: SimpleChanges) {
    if (simpleChanges['video']) {
      this.reload()
    }
  }

  init () {
    this.resetOptions(true)

    if (this.lazyLoad !== true) this.load()
  }

  reload () {
    this.videoPlaylists = []

    this.init()

    this.cd.markForCheck()
  }

  load () {
    forkJoin([
      this.videoPlaylistService.listAccountPlaylists(this.user.account, undefined,'-updatedAt'),
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
              playlistElementId:  existingPlaylist ? existingPlaylist.playlistElementId : undefined,
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
    if (!playlist.playlistElementId) return

    this.videoPlaylistService.removeVideoFromPlaylist(playlist.id, playlist.playlistElementId)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video removed from {{name}}', { name: playlist.displayName }))

            playlist.inPlaylist = false
            playlist.playlistElementId = undefined
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
        res => {
          playlist.inPlaylist = true
          playlist.playlistElementId = res.videoPlaylistElement.id

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
