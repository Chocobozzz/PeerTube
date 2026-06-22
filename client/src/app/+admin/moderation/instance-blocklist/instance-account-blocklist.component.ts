import { Component, ChangeDetectionStrategy } from '@angular/core'
import { BlocklistComponentType } from '@app/shared/shared-moderation/blocklist.service'
import { GenericAccountBlocklistComponent } from '@app/shared/shared-moderation/generic-account-blocklist.component'

@Component({
  selector: 'my-instance-account-blocklist',
  template: `<my-generic-account-blocklist [mode]="mode" key="InstanceAccountBlocklistComponent" />`,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    GenericAccountBlocklistComponent
  ]
})
export class InstanceAccountBlocklistComponent {
  mode = BlocklistComponentType.Instance
}
