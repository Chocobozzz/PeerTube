import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { Subscription } from 'rxjs'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { MyAccountVideoPlaylistEdit } from '@app/+my-account/my-account-video-playlists/my-account-video-playlist-edit'
import { populateAsyncUserVideoChannels } from '@app/shared/misc/utils'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { VideoPlaylistValidatorsService } from '@app/shared'
import { VideoPlaylistUpdate } from '@shared/models/videos/playlist/video-playlist-update.model'
import { VideoConstant } from '@shared/models'
import { VideoPlaylistPrivacy } from '@shared/models/videos/playlist/video-playlist-privacy.model'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'

@Component({
  selector: 'my-account-video-playlist-update',
  templateUrl: './my-account-video-playlist-edit.component.html',
  styleUrls: [ './my-account-video-playlist-edit.component.scss' ]
})
export class MyAccountVideoPlaylistUpdateComponent extends MyAccountVideoPlaylistEdit implements OnInit, OnDestroy {
  error: string
  videoPlaylistToUpdate: VideoPlaylist
  videoPlaylistPrivacies: VideoConstant<VideoPlaylistPrivacy>[] = []

  private paramsSub: Subscription

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private videoPlaylistValidatorsService: VideoPlaylistValidatorsService,
    private notifier: Notifier,
    private router: Router,
    private route: ActivatedRoute,
    private videoPlaylistService: VideoPlaylistService,
    private i18n: I18n,
    private serverService: ServerService
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

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const videoPlaylistId = routeParams['videoPlaylistId']

      this.videoPlaylistService.getVideoPlaylist(videoPlaylistId).subscribe(
        videoPlaylistToUpdate => {
          this.videoPlaylistToUpdate = videoPlaylistToUpdate

          this.hydrateFormFromPlaylist()

          this.serverService.videoPlaylistPrivaciesLoaded.subscribe(
            () => {
              this.videoPlaylistPrivacies = this.serverService.getVideoPlaylistPrivacies()
                .filter(p => {
                  // If the playlist is not private, we cannot put it in private anymore
                  return this.videoPlaylistToUpdate.privacy.id === VideoPlaylistPrivacy.PRIVATE ||
                    p.id !== VideoPlaylistPrivacy.PRIVATE
                })
            }
          )
        },

        err => this.error = err.message
      )
    })
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoPlaylistUpdate: VideoPlaylistUpdate = {
      displayName: body.displayName,
      privacy: body.privacy,
      description: body.description || null,
      videoChannelId: body.videoChannelId || null,
      thumbnailfile: body.thumbnailfile || undefined
    }

    this.videoPlaylistService.updateVideoPlaylist(this.videoPlaylistToUpdate, videoPlaylistUpdate).subscribe(
      () => {
        this.notifier.success(
          this.i18n('Playlist {{videoPlaylistName}} updated.', { videoPlaylistName: videoPlaylistUpdate.displayName })
        )

        this.router.navigate([ '/my-account', 'video-playlists' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return this.i18n('Update')
  }

  private hydrateFormFromPlaylist () {
    this.form.patchValue({
      displayName: this.videoPlaylistToUpdate.displayName,
      privacy: this.videoPlaylistToUpdate.privacy.id,
      description: this.videoPlaylistToUpdate.description,
      videoChannelId: this.videoPlaylistToUpdate.videoChannel ? this.videoPlaylistToUpdate.videoChannel.id : null
    })

    fetch(this.videoPlaylistToUpdate.thumbnailUrl)
      .then(response => response.blob())
      .then(data => {
        this.form.patchValue({
          thumbnailfile: data
        })
      })
  }
}
