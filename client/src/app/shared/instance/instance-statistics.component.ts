import { map } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ServerStats } from '@shared/models/server'
import { environment } from '../../../environments/environment'

@Component({
  selector: 'my-instance-statistics',
  templateUrl: './instance-statistics.component.html',
  styleUrls: [ './instance-statistics.component.scss' ]
})
export class InstanceStatisticsComponent implements OnInit {
  private static BASE_STATS_URL = environment.apiUrl + '/api/v1/server/stats'

  serverStats: ServerStats = null

  constructor (
    private http: HttpClient,
    private i18n: I18n
  ) {
  }

  ngOnInit () {
    this.getStats()
      .subscribe(
        res => {
          this.serverStats = res
        }
      )
  }

  getStats () {
    return this.http
      .get<ServerStats>(InstanceStatisticsComponent.BASE_STATS_URL)
  }
}
