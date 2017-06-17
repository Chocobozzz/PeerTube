import { Component, OnInit, OnDestroy } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'

import { RequestService, RequestSchedulerStatsAttributes } from '../shared'
import { RequestScheduler } from '../../../../../../shared'

@Component({
  selector: 'my-request-stats',
  templateUrl: './request-stats.component.html',
  styleUrls: [ './request-stats.component.scss' ]
})
export class RequestStatsComponent implements OnInit, OnDestroy {
  statsTitles = {
    requestScheduler: 'Basic request scheduler',
    requestVideoEventScheduler: 'Video events request scheduler',
    requestVideoQaduScheduler: 'Quick and dirty video updates request scheduler'
  }

  stats: RequestScheduler

  private intervals: { [ id: string ]: number } = {
    requestScheduler: null,
    requestVideoEventScheduler: null,
    requestVideoQaduScheduler: null
  }

  private timeouts: { [ id: string ]: number } = {
    requestScheduler: null,
    requestVideoEventScheduler: null,
    requestVideoQaduScheduler: null
  }

  constructor (
    private notificationsService: NotificationsService,
    private requestService: RequestService
  ) { }

  ngOnInit () {
    this.getStats()
    this.runIntervals()
  }

  ngOnDestroy () {
    Object.keys(this.stats).forEach(requestSchedulerName => {
      if (this.intervals[requestSchedulerName] !== null) {
        window.clearInterval(this.intervals[requestSchedulerName])
      }

      if (this.timeouts[requestSchedulerName] !== null) {
        window.clearTimeout(this.timeouts[requestSchedulerName])
      }
    })
  }

  getStats () {
    this.requestService.getStats().subscribe(
      stats => this.stats = stats,

      err => this.notificationsService.error('Error', err.text)
    )
  }

  private runIntervals () {
    Object.keys(this.intervals).forEach(requestSchedulerName => {
      this.intervals[requestSchedulerName] = window.setInterval(() => {
        const stats: RequestSchedulerStatsAttributes = this.stats[requestSchedulerName]

        stats.remainingMilliSeconds -= 1000

        if (stats.remainingMilliSeconds <= 0) {
          this.timeouts[requestSchedulerName] = window.setTimeout(() => this.getStats(), stats.remainingMilliSeconds + 100)
        }
      }, 1000)
    })
  }
}
