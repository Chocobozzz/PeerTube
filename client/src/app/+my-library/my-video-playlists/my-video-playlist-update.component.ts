import { forkJoin, Subscription } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { populateAsyncUserVideoChannels } from '@app/helpers'
import {
  setPlaylistChannelValidator,
  VIDEO_PLAYLIST_CHANNEL_ID_VALIDATOR,
  VIDEO_PLAYLIST_DESCRIPTION_VALIDATOR,
  VIDEO_PLAYLIST_DISPLAY_NAME_VALIDATOR,
  VIDEO_PLAYLIST_PRIVACY_VALIDATOR
} from '@app/shared/form-validators/video-playlist-validators'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoPlaylist, VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { VideoPlaylistUpdate } from '@shared/models'
import { MyVideoPlaylistEdit } from './my-video-playlist-edit'

@Component({
  templateUrl: './my-video-playlist-edit.component.html',
  styleUrls: [ './my-video-playlist-edit.component.scss' ]
})
export class MyVideoPlaylistUpdateComponent extends MyVideoPlaylistEdit implements OnInit, OnDestroy {
  error: string
  videoPlaylistToUpdate: VideoPlaylist

  private paramsSub: Subscription

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private router: Router,
    private route: ActivatedRoute,
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

    populateAsyncUserVideoChannels(this.authService, this.userVideoChannels)
      .catch(err => console.error('Cannot populate user video channels.', err))

    this.paramsSub = this.route.params
                         .pipe(
                           map(routeParams => routeParams['videoPlaylistId']),
                           switchMap(videoPlaylistId => {
                             return forkJoin([
                               this.videoPlaylistService.getVideoPlaylist(videoPlaylistId),
                               this.serverService.getVideoPlaylistPrivacies()
                             ])
                           })
                         )
                         .subscribe(
                           ([ videoPlaylistToUpdate, videoPlaylistPrivacies]) => {
                             this.videoPlaylistToUpdate = videoPlaylistToUpdate
                             this.videoPlaylistPrivacies = videoPlaylistPrivacies

                             this.hydrateFormFromPlaylist()
                           },

                           err => this.error = err.message
                         )
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
        this.notifier.success($localize`Playlist ${videoPlaylistUpdate.displayName} updated.`)
        this.router.navigate([ '/my-library', 'video-playlists' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return $localize`Update`
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
