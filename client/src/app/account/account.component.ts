import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'

import { NotificationsService } from 'angular2-notifications'

import { AuthService } from '../core'
import {
  FormReactive,
  User,
  UserService,
  USER_PASSWORD
} from '../shared'

@Component({
  selector: 'my-account',
  templateUrl: './account.component.html',
  styleUrls: [ './account.component.scss' ]
})
export class AccountComponent implements OnInit {
  user: User = null

  constructor (private authService: AuthService) {}

  ngOnInit () {
    this.user = this.authService.getUser()
  }
}
