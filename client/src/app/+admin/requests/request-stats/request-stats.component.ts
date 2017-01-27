import { Component, OnInit, OnDestroy } from '@angular/core';

import { NotificationsService } from 'angular2-notifications';

import { RequestService, RequestStats } from '../shared';

@Component({
	selector: 'my-request-stats',
	templateUrl: './request-stats.component.html',
  styleUrls: [ './request-stats.component.scss' ]
})
export class RequestStatsComponent implements OnInit, OnDestroy {
  stats: RequestStats = null;

  private interval: number = null;
  private timeout: number = null;

  constructor(
    private notificationsService: NotificationsService,
    private requestService: RequestService
  ) {  }

  ngOnInit() {
    this.getStats();
    this.runInterval();
  }

  ngOnDestroy() {
    if (this.interval !== null) {
      window.clearInterval(this.interval);
    }

    if (this.timeout !== null) {
      window.clearTimeout(this.timeout);
    }
  }

  getStats() {
    this.requestService.getStats().subscribe(
      stats => this.stats = stats,

      err => this.notificationsService.error('Error', err.text)
    );
  }

  private runInterval() {
    this.interval = window.setInterval(() => {
      this.stats.remainingMilliSeconds -= 1000;

      if (this.stats.remainingMilliSeconds <= 0) {
        this.timeout = window.setTimeout(() => this.getStats(), this.stats.remainingMilliSeconds + 100);
      }
    }, 1000);
  }


}
