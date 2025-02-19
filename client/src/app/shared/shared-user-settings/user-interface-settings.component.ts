import { Subject, Subscription } from 'rxjs'
import { Component, OnDestroy, OnInit, inject, input } from '@angular/core'
import { AuthService, Notifier, ServerService, ThemeService, UserService } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { HTMLServerConfig, User, UserUpdateMe } from '@peertube/peertube-models'
import { SelectOptionsItem } from 'src/types'
import { NgIf } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { SelectOptionsComponent } from '../shared-forms/select/select-options.component'

@Component({
  selector: 'my-user-interface-settings',
  templateUrl: './user-interface-settings.component.html',
  styleUrls: [ './user-interface-settings.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgIf, SelectOptionsComponent ]
})
export class UserInterfaceSettingsComponent extends FormReactive implements OnInit, OnDestroy {
  protected formReactiveService = inject(FormReactiveService)
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private userService = inject(UserService)
  private themeService = inject(ThemeService)
  private serverService = inject(ServerService)

  readonly user = input<User>(undefined)
  readonly reactiveUpdate = input(false)
  readonly notifyOnUpdate = input(true)
  readonly userInformationLoaded = input<Subject<any>>(undefined)

  availableThemes: SelectOptionsItem[]
  formValuesWatcher: Subscription

  private serverConfig: HTMLServerConfig

  get instanceName () {
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.availableThemes = [
      { id: 'instance-default', label: $localize`${this.instanceName} theme`, description: this.getDefaultInstanceThemeLabel() },

      this.themeService.getDefaultThemeItem(),

      ...this.themeService.buildAvailableThemes()
    ]

    this.buildForm({
      theme: null
    })

    this.userInformationLoaded()
      .subscribe(() => {
        this.form.patchValue({
          theme: this.user().theme
        })

        if (this.reactiveUpdate()) {
          this.formValuesWatcher = this.form.valueChanges.subscribe(() => this.updateInterfaceSettings())
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
      this.userService.updateMyProfile(details)
        .subscribe({
          next: () => {
            this.authService.refreshUserInformation()

            if (this.notifyOnUpdate()) this.notifier.success($localize`Interface settings updated.`)
          },

          error: err => this.notifier.error(err.message)
        })

      return
    }

    this.userService.updateMyAnonymousProfile(details)
    if (this.notifyOnUpdate()) this.notifier.success($localize`Interface settings updated.`)
  }

  private getDefaultInstanceThemeLabel () {
    const theme = this.serverConfig.theme.default

    if (theme === 'default') {
      return this.themeService.getDefaultThemeItem().label
    }

    return theme
  }
}
