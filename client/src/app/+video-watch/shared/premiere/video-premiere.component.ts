import { Component, Input, OnInit, OnDestroy } from '@angular/core'
import { NgIf } from '@angular/common'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription/subscribe-button.component'

interface CountdownTime {
  days: number
  hours: number
  minutes: number
  seconds: number
  isExpired: boolean
}

@Component({
  selector: 'my-video-premiere',
  templateUrl: './video-premiere.component.html',
  styleUrls: [ './video-premiere.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    SubscribeButtonComponent
  ]
})
export class VideoPremiereComponent implements OnInit, OnDestroy {
  @Input() video: VideoDetails
  @Input() theaterEnabled = false

  countdown: CountdownTime = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  }

  private countdownInterval: any

  ngOnInit() {
    this.startCountdown()
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
    }
  }

  private startCountdown() {
    this.updateCountdown()
    this.countdownInterval = setInterval(() => {
      this.updateCountdown()
    }, 1000)
  }

  private updateCountdown() {
    if (!this.video?.scheduledUpdate?.updateAt) {
      this.countdown.isExpired = true
      return
    }

    const premiereTime = new Date(this.video.scheduledUpdate.updateAt).getTime()
    const now = new Date().getTime()
    const timeDiff = premiereTime - now

    if (timeDiff <= 0) {
      this.countdown.isExpired = true
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval)
      }
      return
    }

    this.countdown.days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    this.countdown.hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    this.countdown.minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
    this.countdown.seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)
    this.countdown.isExpired = false
  }
}
