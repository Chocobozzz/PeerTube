import { Component, OnInit, ViewChild } from '@angular/core'
import { AuthService, CanComponentDeactivate, UserService } from '@app/core'
import { MyAccountImportComponent } from './my-account-import.component'
import { first } from 'rxjs'
import { MyAccountExportComponent } from './my-account-export.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-account-import-export',
  templateUrl: './my-account-import-export.component.html',
  standalone: true,
  imports: [ GlobalIconComponent, MyAccountImportComponent, MyAccountExportComponent ]
})
export class MyAccountImportExportComponent implements OnInit, CanComponentDeactivate {
  @ViewChild('accountImport') accountImport: MyAccountImportComponent

  videoQuotaUsed: number

  constructor (
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit () {
    this.authService.userInformationLoaded
      .pipe(first())
      .subscribe(() => {
        this.userService.getMyVideoQuotaUsed()
          .subscribe(res => this.videoQuotaUsed = res.videoQuotaUsed)
      })
  }

  canDeactivate () {
    return this.accountImport?.canDeactivate() || { canDeactivate: true }
  }
}
