import { Component, Input } from '@angular/core'
import { Notifier } from '@app/core'
import { RedundancyService } from '@app/shared/shared-main'

@Component({
  selector: 'my-redundancy-checkbox',
  templateUrl: './redundancy-checkbox.component.html'
})
export class RedundancyCheckboxComponent {
  @Input() redundancyAllowed: boolean
  @Input() host: string

  constructor (
    private notifier: Notifier,
    private redundancyService: RedundancyService
  ) { }

  updateRedundancyState () {
    this.redundancyService.updateRedundancy(this.host, this.redundancyAllowed)
        .subscribe({
          next: () => {
            const stateLabel = this.redundancyAllowed ? $localize`enabled` : $localize`disabled`

            this.notifier.success($localize`Redundancy for ${this.host} is ${stateLabel}`)
          },

          error: err => this.notifier.error(err.message)
        })
  }
}
