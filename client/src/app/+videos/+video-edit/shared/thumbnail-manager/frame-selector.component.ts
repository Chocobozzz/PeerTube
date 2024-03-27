import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, Output, EventEmitter, ViewEncapsulation } from '@angular/core'
import videojs from 'video.js'

@Component({
  selector: 'my-frame-selector',
  template: `
  <div class="video-wrapper">
    <div class="videojs-wrapper">
      <video #frameSelector class="video-js vjs-peertube-skin" preload="none">
      </video>
    </div>
  </div>
  `,
  styleUrls: [ './frame-selector.component.scss' ],
  /* eslint-disable @angular-eslint/use-component-view-encapsulation */
  encapsulation: ViewEncapsulation.None,
  standalone: true
})

export class FrameSelectorComponent implements OnInit, OnDestroy {
  @ViewChild('frameSelector', { static: true }) target: ElementRef

  @Input() source: string

  @Output() timeChanged = new EventEmitter<number>()

  private player: videojs.Player

  ngOnInit () {

    // Configuring the player, optimizing for frame selection
    const options = {
      sources: [ {
        src: this.source
      } ],
      controlBar: {
        fullscreenToggle: false
      },
      disablePictureInPicture: true,
      controls: true,
      muted: true,
      fluid: true,
      aspectRatio: '16:9',
      playsinline: true,
      userActions: {
        hotkeys: (event: videojs.KeyboardEvent) => {

          // Space -pause/play
          if (event.key === ' ') {

            if (this.player.paused()) {

              this.player.play()

            } else {
              this.player.pause()
            }
          }

          // Allow more accurate frame selection
          if (event.key === 'ArrowRight') {

            // Stop the video
            this.player.pause()

            // Forward
            const step = 0.5
            this.player.currentTime(this.player.currentTime() + step)
          }
          if (event.key === 'ArrowLeft') {

            // Stop the video
            this.player.pause()

            // Back
            const step = 0.5
            this.player.currentTime(this.player.currentTime() - step)
          }
        }
      }
    }

    // Create the player
    this.player = videojs(this.target.nativeElement, options)

    // Waiting then calling instead of call back. Makes it easier to reference
    // the event emitter
    this.onPlayerReady()

  }

  // Dispose the player OnDestroy
  ngOnDestroy () {
    if (this.player) {
      this.player.dispose()
    }
  }

  onTimeChanged (value: number) {
    this.timeChanged.emit(value)
  }

  onPlayerReady () {

    this.player.on('timeupdate', () => {
      // Event listener that will emit the current time
      this.onTimeChanged(this.player.currentTime())
    })
  }
}
