import { Component } from '@angular/core'
import { BlocklistComponentType } from '@app/shared/shared-moderation/blocklist.service'
import { GenericServerBlocklistComponent } from '../../../shared/shared-moderation/generic-server-blocklist.component'

@Component({
  selector: 'my-instance-server-blocklist',
  template: `<my-generic-server-blocklist [mode]="mode" key="InstanceServerBlocklistComponent" />`,
  imports: [
    GenericServerBlocklistComponent
  ]
})
export class InstanceServerBlocklistComponent {
  mode = BlocklistComponentType.Instance
}
