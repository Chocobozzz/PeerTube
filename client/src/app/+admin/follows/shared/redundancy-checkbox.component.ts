import { Component, Input } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RedundancyService } from '@app/+admin/follows/shared/redundancy.service'

@Component({
  selector: 'my-redundancy-checkbox',
  templateUrl: './redundancy-checkbox.component.html',
  styleUrls: [ './redundancy-checkbox.component.scss' ]
})
export class RedundancyCheckboxComponent {
  @Input() redundancyAllowed: boolean
  @Input() host: string

  constructor (
    private notificationsService: NotificationsService,
    private redundancyService: RedundancyService,
    private i18n: I18n
  ) { }

  updateRedundancyState () {
    this.redundancyService.updateRedundancy(this.host, this.redundancyAllowed)
      .subscribe(
        () => {
          const stateLabel = this.redundancyAllowed ? this.i18n('enabled') : this.i18n('disabled')

          this.notificationsService.success(
            this.i18n('Success'),
            this.i18n('Redundancy for {{host}} is {{stateLabel}}', { host: this.host, stateLabel })
          )
        },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }
}
