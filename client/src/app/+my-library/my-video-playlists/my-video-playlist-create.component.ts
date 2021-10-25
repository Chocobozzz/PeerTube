import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { listUserChannels } from '@app/helpers'
import {
  setPlaylistChannelValidator,
  VIDEO_PLAYLIST_CHANNEL_ID_VALIDATOR,
  VIDEO_PLAYLIST_DESCRIPTION_VALIDATOR,
  VIDEO_PLAYLIST_DISPLAY_NAME_VALIDATOR,
  VIDEO_PLAYLIST_PRIVACY_VALIDATOR
} from '@app/shared/form-validators/video-playlist-validators'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { VideoPlaylistCreate } from '@shared/models/videos/playlist/video-playlist-create.model'
import { VideoPlaylistPrivacy } from '@shared/models/videos/playlist/video-playlist-privacy.model'
import { MyVideoPlaylistEdit } from './my-video-playlist-edit'

@Component({
  templateUrl: './my-video-playlist-edit.component.html',
  styleUrls: [ './my-video-playlist-edit.component.scss' ]
})
export class MyVideoPlaylistCreateComponent extends MyVideoPlaylistEdit implements OnInit {
  error: string

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private router: Router,
    private videoPlaylistService: VideoPlaylistService,
    private serverService: ServerService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      displayName: VIDEO_PLAYLIST_DISPLAY_NAME_VALIDATOR,
      privacy: VIDEO_PLAYLIST_PRIVACY_VALIDATOR,
      description: VIDEO_PLAYLIST_DESCRIPTION_VALIDATOR,
      videoChannelId: VIDEO_PLAYLIST_CHANNEL_ID_VALIDATOR,
      thumbnailfile: null
    })

    this.form.get('privacy').valueChanges.subscribe(privacy => {
      setPlaylistChannelValidator(this.form.get('videoChannelId'), privacy)
    })

    listUserChannels(this.authService)
      .subscribe(channels => this.userVideoChannels = channels)

    this.serverService.getVideoPlaylistPrivacies()
        .subscribe(videoPlaylistPrivacies => {
          this.videoPlaylistPrivacies = videoPlaylistPrivacies

          this.form.patchValue({
            privacy: VideoPlaylistPrivacy.PRIVATE
          })
        })
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoPlaylistCreate: VideoPlaylistCreate = {
      displayName: body.displayName,
      privacy: body.privacy,
      description: body.description || null,
      videoChannelId: body.videoChannelId || null,
      thumbnailfile: body.thumbnailfile || null
    }

    this.videoPlaylistService.createVideoPlaylist(videoPlaylistCreate)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Playlist ${videoPlaylistCreate.displayName} created.`)
          this.router.navigate([ '/my-library', 'video-playlists' ])
        },

        error: err => {
          this.error = err.message
        }
      })
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return $localize`Create`
  }
}
