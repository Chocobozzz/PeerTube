import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'

import { AuthService } from '../core'
import { FormReactive } from '../shared'

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html'
})

export class LoginComponent extends FormReactive implements OnInit {
  error: string = null

  form: FormGroup
  formErrors = {
    'username': '',
    'password': ''
  }
  validationMessages = {
    'username': {
      'required': 'Username is required.'
    },
    'password': {
      'required': 'Password is required.'
    }
  }

  constructor (
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      username: [ '', Validators.required ],
      password: [ '', Validators.required ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()
  }

  login () {
    this.error = null

    const { username, password } = this.form.value

    this.authService.login(username, password).subscribe(
      result => this.router.navigate(['/videos/list']),

      error => {
        console.error(error.json)

        if (error.json.error === 'invalid_grant') {
          this.error = 'Credentials are invalid.'
        } else {
          this.error = `${error.json.error}: ${error.json.error_description}`
        }
      }
    )
  }
}
