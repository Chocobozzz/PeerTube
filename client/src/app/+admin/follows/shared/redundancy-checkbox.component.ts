import { Component, Input } from '@angular/core'
import { Notifier } from '@app/core'
import { RedundancyService } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-redundancy-checkbox',
  templateUrl: './redundancy-checkbox.component.html',
  styleUrls: [ './redundancy-checkbox.component.scss' ]
})
export class RedundancyCheckboxComponent {
  @Input() redundancyAllowed: boolean
  @Input() host: string

  constructor (
    private notifier: Notifier,
    private redundancyService: RedundancyService,
    private i18n: I18n
  ) { }

  updateRedundancyState () {
    this.redundancyService.updateRedundancy(this.host, this.redundancyAllowed)
        .subscribe(
          () => {
            const stateLabel = this.redundancyAllowed ? this.i18n('enabled') : this.i18n('disabled')

            this.notifier.success(this.i18n('Redundancy for {{host}} is {{stateLabel}}', { host: this.host, stateLabel }))
          },

          err => this.notifier.error(err.message)
        )
  }
}
