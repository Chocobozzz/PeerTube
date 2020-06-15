import { Component } from '@angular/core'
import { GenericServerBlocklistComponent, BlocklistComponentType } from '@app/shared/blocklist'

@Component({
  selector: 'my-instance-server-blocklist',
  styleUrls: [ '../../../shared/blocklist/server-blocklist.component.scss' ],
  templateUrl: '../../../shared/blocklist/server-blocklist.component.html'
})
export class InstanceServerBlocklistComponent extends GenericServerBlocklistComponent {
  mode = BlocklistComponentType.Instance

  getIdentifier () {
    return 'InstanceServerBlocklistComponent'
  }
}
