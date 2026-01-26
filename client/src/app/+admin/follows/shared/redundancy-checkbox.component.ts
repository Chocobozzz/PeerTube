import { Component, inject, input, model } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { RedundancyService } from '@app/shared/shared-main/video/redundancy.service'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'

@Component({
  selector: 'my-redundancy-checkbox',
  templateUrl: './redundancy-checkbox.component.html',
  imports: [ PeertubeCheckboxComponent, FormsModule ]
})
export class RedundancyCheckboxComponent {
  private notifier = inject(Notifier)
  private redundancyService = inject(RedundancyService)

  readonly host = input<string>(undefined)
  readonly redundancyAllowed = model<boolean>(undefined)

  updateRedundancyState () {
    this.redundancyService.updateRedundancy(this.host(), this.redundancyAllowed())
      .subscribe({
        next: () => {
          const stateLabel = this.redundancyAllowed() ? $localize`enabled` : $localize`disabled`

          this.notifier.success($localize`Redundancy for ${this.host()} is ${stateLabel}`)
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
