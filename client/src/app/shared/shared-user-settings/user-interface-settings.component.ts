import { Subject, Subscription } from 'rxjs'
import { Component, Input, OnDestroy, OnInit } from '@angular/core'
import { AuthService, Notifier, ServerService, ThemeService, UserService } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { HTMLServerConfig, User, UserUpdateMe } from '@peertube/peertube-models'
import { SelectOptionsItem } from 'src/types'
import { NgFor, NgIf } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'

@Component({
  selector: 'my-user-interface-settings',
  templateUrl: './user-interface-settings.component.html',
  styleUrls: [ './user-interface-settings.component.scss' ],
  standalone: true,
  imports: [ FormsModule, ReactiveFormsModule, NgFor, NgIf ]
})
export class UserInterfaceSettingsComponent extends FormReactive implements OnInit, OnDestroy {
  @Input() user: User
  @Input() reactiveUpdate = false
  @Input() notifyOnUpdate = true
  @Input() userInformationLoaded: Subject<any>

  availableThemes: SelectOptionsItem[]
  formValuesWatcher: Subscription

  private serverConfig: HTMLServerConfig

  constructor (
    protected formReactiveService: FormReactiveService,
    private authService: AuthService,
    private notifier: Notifier,
    private userService: UserService,
    private themeService: ThemeService,
    private serverService: ServerService
  ) {
    super()
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.availableThemes = this.themeService.buildAvailableThemes()

    this.buildForm({
      theme: null
    })

    this.userInformationLoaded
      .subscribe(() => {
        this.form.patchValue({
          theme: this.user.theme
        })

        if (this.reactiveUpdate) {
          this.formValuesWatcher = this.form.valueChanges.subscribe(() => this.updateInterfaceSettings())
        }
      })
  }

  ngOnDestroy () {
    this.formValuesWatcher?.unsubscribe()
  }

  getDefaultThemeLabel () {
    return this.themeService.getDefaultThemeLabel()
  }

  getDefaultInstanceThemeLabel () {
    const theme = this.serverConfig.theme.default

    if (theme === 'default') {
      return this.getDefaultThemeLabel()
    }

    return theme
  }

  updateInterfaceSettings () {
    const theme = this.form.value['theme']

    const details: UserUpdateMe = {
      theme
    }

    if (this.authService.isLoggedIn()) {
      this.userService.updateMyProfile(details)
        .subscribe({
          next: () => {
            this.authService.refreshUserInformation()

            if (this.notifyOnUpdate) this.notifier.success($localize`Interface settings updated.`)
          },

          error: err => this.notifier.error(err.message)
        })

      return
    }

    this.userService.updateMyAnonymousProfile(details)
    if (this.notifyOnUpdate) this.notifier.success($localize`Interface settings updated.`)
  }
}
