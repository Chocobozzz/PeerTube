import { finalize } from 'rxjs/operators'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, input, output } from '@angular/core'
import { Notifier } from '@app/core'
import { CustomMarkupComponent } from './shared'
import { VideoPlaylistMiniatureComponent } from '../../shared-video-playlist/video-playlist-miniature.component'

import { FindInBulkService } from '@app/shared/shared-search/find-in-bulk.service'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature/video-miniature.component'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'

/*
 * Markup component that creates a playlist miniature only
 */

@Component({
  selector: 'my-playlist-miniature-markup',
  templateUrl: 'playlist-miniature-markup.component.html',
  styleUrls: [ 'playlist-miniature-markup.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ VideoPlaylistMiniatureComponent ]
})
export class PlaylistMiniatureMarkupComponent implements CustomMarkupComponent, OnInit {
  private findInBulkService = inject(FindInBulkService)
  private notifier = inject(Notifier)
  private cd = inject(ChangeDetectorRef)

  readonly uuid = input<string>(undefined)

  readonly loaded = output<boolean>()

  playlist: VideoPlaylist

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true,
    privacyLabel: false
  }

  ngOnInit () {
    this.findInBulkService.getPlaylist(this.uuid())
      .pipe(finalize(() => this.loaded.emit(true)))
      .subscribe({
        next: playlist => {
          this.playlist = playlist
          this.cd.markForCheck()
        },

        error: err => this.notifier.error($localize`Error in playlist miniature component: ${err.message}`)
      })
  }
}
