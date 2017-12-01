import { Component, OnInit } from '@angular/core'
import { User } from '../../shared'
import { AuthService } from '../../core'

@Component({
  selector: 'my-account-settings',
  templateUrl: './account-settings.component.html',
  styleUrls: [ './account-settings.component.scss' ]
})
export class AccountSettingsComponent implements OnInit {
  user: User = null

  constructor (private authService: AuthService) {}

  ngOnInit () {
    this.user = this.authService.getUser()
  }
}
