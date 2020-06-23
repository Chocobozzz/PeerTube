import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { FormValidatorService, VideoPlaylistValidatorsService } from '@app/shared/shared-forms'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoPlaylistCreate } from '@shared/models/videos/playlist/video-playlist-create.model'
import { VideoPlaylistPrivacy } from '@shared/models/videos/playlist/video-playlist-privacy.model'
import { MyAccountVideoPlaylistEdit } from './my-account-video-playlist-edit'
import { populateAsyncUserVideoChannels } from '@app/helpers'

@Component({
  selector: 'my-account-video-playlist-create',
  templateUrl: './my-account-video-playlist-edit.component.html',
  styleUrls: [ './my-account-video-playlist-edit.component.scss' ]
})
export class MyAccountVideoPlaylistCreateComponent extends MyAccountVideoPlaylistEdit implements OnInit {
  error: string

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private videoPlaylistValidatorsService: VideoPlaylistValidatorsService,
    private notifier: Notifier,
    private router: Router,
    private videoPlaylistService: VideoPlaylistService,
    private serverService: ServerService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      displayName: this.videoPlaylistValidatorsService.VIDEO_PLAYLIST_DISPLAY_NAME,
      privacy: this.videoPlaylistValidatorsService.VIDEO_PLAYLIST_PRIVACY,
      description: this.videoPlaylistValidatorsService.VIDEO_PLAYLIST_DESCRIPTION,
      videoChannelId: this.videoPlaylistValidatorsService.VIDEO_PLAYLIST_CHANNEL_ID,
      thumbnailfile: null
    })

    this.form.get('privacy').valueChanges.subscribe(privacy => {
      this.videoPlaylistValidatorsService.setChannelValidator(this.form.get('videoChannelId'), privacy)
    })

    populateAsyncUserVideoChannels(this.authService, this.userVideoChannels)
      .catch(err => console.error('Cannot populate user video channels.', err))

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

    this.videoPlaylistService.createVideoPlaylist(videoPlaylistCreate).subscribe(
      () => {
        this.notifier.success(
          this.i18n('Playlist {{playlistName}} created.', { playlistName: videoPlaylistCreate.displayName })
        )
        this.router.navigate([ '/my-account', 'video-playlists' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return this.i18n('Create')
  }
}
