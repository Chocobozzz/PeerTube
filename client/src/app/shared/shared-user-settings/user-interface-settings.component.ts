import { Subject, Subscription } from 'rxjs'
import { Component, Input, OnDestroy, OnInit } from '@angular/core'
import { AuthService, Notifier, ServerService, UserService } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { HTMLServerConfig, User, UserUpdateMe } from '@shared/models'

@Component({
  selector: 'my-user-interface-settings',
  templateUrl: './user-interface-settings.component.html',
  styleUrls: [ './user-interface-settings.component.scss' ]
})
export class UserInterfaceSettingsComponent extends FormReactive implements OnInit, OnDestroy {
  @Input() user: User = null
  @Input() reactiveUpdate = false
  @Input() notifyOnUpdate = true
  @Input() userInformationLoaded: Subject<any>

  formValuesWatcher: Subscription

  private serverConfig: HTMLServerConfig

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private userService: UserService,
    private serverService: ServerService
  ) {
    super()
  }

  get availableThemes () {
    return this.serverConfig.theme.registered
               .map(t => t.name)
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.buildForm({
      theme: null
    })

    this.userInformationLoaded
      .subscribe(() => {
        this.form.patchValue({
          theme: this.user.theme
        })

        if (this.reactiveUpdate) {
          this.formValuesWatcher = this.form.valueChanges.subscribe(val => this.updateInterfaceSettings())
        }
      })
  }

  ngOnDestroy () {
    this.formValuesWatcher?.unsubscribe()
  }

  updateInterfaceSettings () {
    const theme = this.form.value['theme']

    const details: UserUpdateMe = {
      theme
    }

    if (this.authService.isLoggedIn()) {
      this.userService.updateMyProfile(details).subscribe(
        () => {
          this.authService.refreshUserInformation()

          if (this.notifyOnUpdate) this.notifier.success($localize`Interface settings updated.`)
        },

        err => this.notifier.error(err.message)
      )
    } else {
      this.userService.updateMyAnonymousProfile(details)
      if (this.notifyOnUpdate) this.notifier.success($localize`Interface settings updated.`)
    }
  }
}
