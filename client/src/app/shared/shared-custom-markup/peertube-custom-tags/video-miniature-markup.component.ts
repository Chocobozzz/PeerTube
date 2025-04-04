import { NgIf } from '@angular/common'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, input, model, output } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { Video } from '@app/shared/shared-main/video/video.model'
import { FindInBulkService } from '@app/shared/shared-search/find-in-bulk.service'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { finalize } from 'rxjs/operators'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from '../../shared-video-miniature/video-miniature.component'
import { CustomMarkupComponent } from './shared'

/*
 * Markup component that creates a video miniature only
 */

@Component({
  selector: 'my-video-miniature-markup',
  templateUrl: 'video-miniature-markup.component.html',
  styleUrls: [ 'video-miniature-markup.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ NgIf, VideoMiniatureComponent ]
})
export class VideoMiniatureMarkupComponent implements CustomMarkupComponent, OnInit {
  private auth = inject(AuthService)
  private findInBulk = inject(FindInBulkService)
  private notifier = inject(Notifier)
  private cd = inject(ChangeDetectorRef)

  readonly uuid = input<string>(undefined)
  readonly onlyDisplayTitle = input<boolean>(undefined)
  readonly video = model<Video>(undefined)

  readonly loaded = output<boolean>()

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true,
    privacyLabel: false,
    privacyText: false,
    blacklistInfo: false
  }

  getUser () {
    return this.auth.getUser()
  }

  ngOnInit () {
    if (this.onlyDisplayTitle()) {
      for (const key of objectKeysTyped(this.displayOptions)) {
        this.displayOptions[key] = false
      }
    }

    if (this.video()) return

    this.findInBulk.getVideo(this.uuid())
      .pipe(finalize(() => this.loaded.emit(true)))
      .subscribe({
        next: video => {
          this.video.set(video)
          this.cd.markForCheck()
        },

        error: err => this.notifier.error($localize`Error in video miniature component: ${err.message}`)
      })
  }
}
