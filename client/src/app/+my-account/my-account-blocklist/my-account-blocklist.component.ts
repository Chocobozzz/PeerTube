import { Component } from '@angular/core'
import { BlocklistComponentType } from '@app/shared/shared-moderation/blocklist.service'
import { GenericAccountBlocklistComponent } from '@app/shared/shared-moderation/generic-account-blocklist.component'

@Component({
  selector: 'my-account-blocklist',
  template: `<my-generic-account-blocklist [mode]="mode" key="MyAccountBlocklistComponent" />`,
  imports: [
    GenericAccountBlocklistComponent
  ]
})
export class MyAccountBlocklistComponent {
  mode = BlocklistComponentType.Account
}
