import { Component, inject, output, signal } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { form, FormField } from '@angular/forms/signals'
import { Notifier } from '@app/core'
import { FormInputErrorDirective } from '@app/shared/shared-forms/form-input-error.directive'
import { VideoPlaylistCreate, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import { playlistDisplayNameValidator } from '../../form-validators/video-playlist-validators'
import { FormErrorComponent } from '../../shared-forms/form-error.component'
import { VideoPlaylistService } from '../video-playlist.service'

@Component({
  selector: 'my-playlist-create-block',
  templateUrl: './playlist-create-block.component.html',
  styleUrls: [ './playlist-create-block.component.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    FormInputErrorDirective,
    FormField,
    FormErrorComponent
  ]
})
export class PlaylistCreateBlockComponent {
  private notifier = inject(Notifier)
  private videoPlaylistService = inject(VideoPlaylistService)

  readonly playlistCreated = output()

  readonly playlistModel = signal<{ displayName: string }>({ displayName: '' })
  readonly playlistForm = form(this.playlistModel, f => {
    playlistDisplayNameValidator(f.displayName)
  })

  createPlaylist () {
    const displayName = this.playlistModel().displayName.trim()

    const videoPlaylistCreate: VideoPlaylistCreate = {
      displayName,
      privacy: VideoPlaylistPrivacy.PRIVATE
    }

    this.videoPlaylistService.createVideoPlaylist(videoPlaylistCreate)
      .subscribe({
        next: () => {
          this.playlistCreated.emit()
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
