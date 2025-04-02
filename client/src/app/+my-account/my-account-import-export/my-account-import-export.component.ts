import { Component, OnInit, inject, viewChild } from '@angular/core'
import { CanComponentDeactivate, UserService } from '@app/core'

import { MyAccountExportComponent } from './my-account-export.component'
import { MyAccountImportComponent } from './my-account-import.component'

@Component({
  selector: 'my-account-import-export',
  templateUrl: './my-account-import-export.component.html',
  imports: [ MyAccountImportComponent, MyAccountExportComponent ]
})
export class MyAccountImportExportComponent implements OnInit, CanComponentDeactivate {
  private userService = inject(UserService)

  readonly accountImport = viewChild<MyAccountImportComponent>('accountImport')

  videoQuotaUsed: number

  ngOnInit () {
    this.userService.getMyVideoQuotaUsed()
      .subscribe(res => this.videoQuotaUsed = res.videoQuotaUsed)
  }

  canDeactivate () {
    return this.accountImport()?.canDeactivate() || { canDeactivate: true }
  }
}
