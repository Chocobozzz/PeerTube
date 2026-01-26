import { booleanAttribute, Component, inject, input, OnDestroy, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { AuthService, Notifier, ServerService, ThemeService, UserService } from '@app/core'
import {
  BuildFormArgumentTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped,
  FormReactiveService
} from '@app/shared/shared-forms/form-reactive.service'
import { I18N_LOCALES } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, User, UserUpdateMe } from '@peertube/peertube-models'
import { of, Subject, Subscription, switchMap } from 'rxjs'
import { SelectOptionsItem } from 'src/types'
import { SelectOptionsComponent } from '../shared-forms/select/select-options.component'

type Form = {
  theme: FormControl<string>
  language: FormControl<string>
}

@Component({
  selector: 'my-user-interface-settings',
  templateUrl: './user-interface-settings.component.html',
  styleUrls: [ './user-interface-settings.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, SelectOptionsComponent ]
})
export class UserInterfaceSettingsComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)

  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private userService = inject(UserService)
  private themeService = inject(ThemeService)
  private serverService = inject(ServerService)

  readonly user = input<Pick<User, 'theme' | 'language'>>(undefined)
  readonly reactiveUpdate = input(false, { transform: booleanAttribute })
  readonly notifyOnUpdate = input(true, { transform: booleanAttribute })
  readonly userInformationLoaded = input<Subject<any>>(undefined)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  availableThemes: SelectOptionsItem[]
  availableLanguages: SelectOptionsItem[]

  formValuesWatcher: Subscription
  userInfoSub: Subscription

  private serverConfig: HTMLServerConfig
  private initialUserLanguage: string
  private updating = false

  get instanceName () {
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()
    this.initialUserLanguage = this.user().language

    this.availableThemes = [
      { id: 'instance-default', label: $localize`${this.instanceName} theme`, description: this.getDefaultInstanceThemeLabel() },

      this.themeService.getDefaultThemeItem(),

      ...this.themeService.buildAvailableThemes()
    ]

    this.availableLanguages = Object.entries(I18N_LOCALES).map(([ id, label ]) => ({ label, id }))

    this.buildForm()

    this.userInfoSub = this.userInformationLoaded()
      .subscribe(() => {
        this.form.patchValue({
          theme: this.user().theme,
          language: this.user().language
        })

        if (this.reactiveUpdate()) {
          this.formValuesWatcher = this.form.valueChanges.subscribe(() => this.updateInterfaceSettings())
        }
      })
  }

  ngOnDestroy () {
    this.formValuesWatcher?.unsubscribe()
    this.userInfoSub?.unsubscribe()
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      theme: null,
      language: null
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  // ---------------------------------------------------------------------------

  updateInterfaceSettings () {
    if (this.updating) return
    this.updating = true

    const { theme, language } = this.form.value

    const details: UserUpdateMe = {
      theme,
      language
    }
    const changedLanguage = language !== this.initialUserLanguage

    const changeLanguageObs = changedLanguage
      ? this.userService.updateInterfaceLanguage(details.language)
      : of(true)

    if (this.authService.isLoggedIn()) {
      this.userService.updateMyProfile(details)
        .pipe(switchMap(() => changeLanguageObs))
        .subscribe({
          next: () => {
            if (changedLanguage) {
              window.location.reload()
              return
            }

            this.authService.refreshUserInformation()
            this.updating = false

            if (this.notifyOnUpdate()) this.notifier.success($localize`Interface settings updated.`)
          },

          error: err => this.notifier.handleError(err)
        })

      return
    }

    this.userService.updateMyAnonymousProfile(details)
    if (changedLanguage) {
      changeLanguageObs.subscribe({
        next: () => {
          window.location.reload()
        },

        error: err => this.notifier.handleError(err)
      })

      return
    }

    if (this.notifyOnUpdate()) this.notifier.success($localize`Interface settings updated.`)
    this.updating = false
  }

  getSubmitValue () {
    return $localize`Save interface settings`
  }

  private getDefaultInstanceThemeLabel () {
    const theme = this.serverConfig.theme.default

    if (theme === 'default') {
      return this.themeService.getDefaultThemeItem().label
    }

    return theme
  }
}
