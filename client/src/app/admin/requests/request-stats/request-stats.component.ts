import { Component, OnInit, OnDestroy } from '@angular/core';

import { RequestService, RequestStats } from '../shared';

@Component({
	selector: 'my-request-stats',
	templateUrl: './request-stats.component.html',
  styleUrls: [ './request-stats.component.scss' ]
})
export class RequestStatsComponent implements OnInit, OnDestroy {
  stats: RequestStats = null;

  private interval: NodeJS.Timer = null;

  constructor(private requestService: RequestService) {  }

  ngOnInit() {
    this.getStats();
  }

  ngOnDestroy() {
    if (this.stats.secondsInterval !== null) {
      clearInterval(this.interval);
    }
  }

  getStats() {
    this.requestService.getStats().subscribe(
      stats => {
        console.log(stats);
        this.stats = stats;
        this.runInterval();
      },

      err => alert(err)
    );
  }

  private runInterval() {
    this.interval = setInterval(() => {
      this.stats.remainingMilliSeconds -= 1000;

      if (this.stats.remainingMilliSeconds <= 0) {
        setTimeout(() => this.getStats(), this.stats.remainingMilliSeconds + 100);
        clearInterval(this.interval);
      }
    }, 1000);
  }


}
