import { finalize } from 'rxjs/operators'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { CustomMarkupComponent } from './shared'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from '../../shared-video-miniature/video-miniature.component'
import { NgIf } from '@angular/common'
import { Video } from '@app/shared/shared-main/video/video.model'
import { FindInBulkService } from '@app/shared/shared-search/find-in-bulk.service'

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
  @Input() uuid: string
  @Input() onlyDisplayTitle: boolean
  @Input() video: Video

  @Output() loaded = new EventEmitter<boolean>()

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true,
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  constructor (
    private auth: AuthService,
    private findInBulk: FindInBulkService,
    private notifier: Notifier,
    private cd: ChangeDetectorRef
  ) { }

  getUser () {
    return this.auth.getUser()
  }

  ngOnInit () {
    if (this.onlyDisplayTitle) {
      for (const key of objectKeysTyped(this.displayOptions)) {
        this.displayOptions[key] = false
      }
    }

    if (this.video) return

    this.findInBulk.getVideo(this.uuid)
      .pipe(finalize(() => this.loaded.emit(true)))
      .subscribe({
        next: video => {
          this.video = video
          this.cd.markForCheck()
        },

        error: err => this.notifier.error($localize`Error in video miniature component: ${err.message}`)
      })
  }
}
