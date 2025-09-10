import { Component } from '@angular/core'
import { BlocklistComponentType } from '@app/shared/shared-moderation/blocklist.service'
import { GenericServerBlocklistComponent } from '../../shared/shared-moderation/generic-server-blocklist.component'

@Component({
  selector: 'my-account-server-blocklist',
  template: `<my-generic-server-blocklist [mode]="mode" key="MyAccountServerBlocklistComponent" />`,
  imports: [
    GenericServerBlocklistComponent
  ]
})
export class MyAccountServerBlocklistComponent {
  mode = BlocklistComponentType.Account
}
