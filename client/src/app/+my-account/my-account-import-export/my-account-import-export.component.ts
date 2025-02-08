import { Component, OnInit, ViewChild } from '@angular/core'
import { CanComponentDeactivate, UserService } from '@app/core'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { MyAccountExportComponent } from './my-account-export.component'
import { MyAccountImportComponent } from './my-account-import.component'

@Component({
  selector: 'my-account-import-export',
  templateUrl: './my-account-import-export.component.html',
  imports: [ GlobalIconComponent, MyAccountImportComponent, MyAccountExportComponent ]
})
export class MyAccountImportExportComponent implements OnInit, CanComponentDeactivate {
  @ViewChild('accountImport') accountImport: MyAccountImportComponent

  videoQuotaUsed: number

  constructor (
    private userService: UserService
  ) {}

  ngOnInit () {
    this.userService.getMyVideoQuotaUsed()
      .subscribe(res => this.videoQuotaUsed = res.videoQuotaUsed)
  }

  canDeactivate () {
    return this.accountImport?.canDeactivate() || { canDeactivate: true }
  }
}
