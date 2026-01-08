import { Component, OnDestroy, OnInit, booleanAttribute, inject, input } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { AuthService, Notifier, ServerService, User, UserService } from '@app/core'
import { FormReactiveErrors, FormReactiveMessages, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NSFWFlag, NSFWFlagType, NSFWPolicyType, UserUpdateMe } from '@peertube/peertube-models'
import { pick } from 'lodash-es'
import { Subject, Subscription } from 'rxjs'
import { first } from 'rxjs/operators'
import { SelectOptionsItem } from 'src/types'
import { BuildFormArgument } from '../form-validators/form-validator.model'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { SelectLanguagesComponent } from '../shared-forms/select/select-languages.component'
import { SelectRadioComponent } from '../shared-forms/select/select-radio.component'
import { HelpComponent } from '../shared-main/buttons/help.component'

type NSFWFlagPolicyType = NSFWPolicyType | 'default'

type Form = {
  nsfwPolicy: FormControl<NSFWPolicyType>
  nsfwFlagViolent: FormControl<NSFWFlagPolicyType>
  nsfwFlagSex: FormControl<NSFWFlagPolicyType>

  p2pEnabled: FormControl<boolean>
  autoPlayVideo: FormControl<boolean>
  autoPlayNextVideo: FormControl<boolean>
  videoLanguages: FormControl<string[]>
}

@Component({
  selector: 'my-user-video-settings',
  templateUrl: './user-video-settings.component.html',
  styleUrls: [ './user-video-settings.component.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    HelpComponent,
    SelectLanguagesComponent,
    PeertubeCheckboxComponent,
    SelectRadioComponent
  ]
})
export class UserVideoSettingsComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private userService = inject(UserService)
  private serverService = inject(ServerService)

  readonly user = input<User>(null)
  readonly reactiveUpdate = input(false, { transform: booleanAttribute })
  readonly notifyOnUpdate = input(true, { transform: booleanAttribute })
  readonly userInformationLoaded = input<Subject<any>>(undefined)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

  nsfwItems: SelectOptionsItem[] = [
    {
      id: 'do_not_list',
      label: $localize`Hide`
    },
    {
      id: 'blur',
      label: $localize`Blur`
    },
    {
      id: 'warn',
      label: $localize`Warn`
    },
    {
      id: 'display',
      label: $localize`Display`
    }
  ]

  nsfwFlagItems: SelectOptionsItem[] = [
    {
      id: 'default',
      label: $localize`Default`
    },
    {
      id: 'do_not_list',
      label: $localize`Hide`
    },
    {
      id: 'blur',
      label: $localize`Blur`
    },
    {
      id: 'warn',
      label: $localize`Warn`
    },
    {
      id: 'display',
      label: $localize`Display`
    }
  ]

  formValuesWatcher: Subscription

  ngOnInit () {
    this.buildForm()

    this.updateNSFWDefaultLabel(this.user().nsfwPolicy)
    this.form.controls.nsfwPolicy.valueChanges.subscribe(nsfwPolicy => this.updateNSFWDefaultLabel(nsfwPolicy))

    this.userInformationLoaded().pipe(first())
      .subscribe(
        () => {
          const serverConfig = this.serverService.getHTMLConfig()
          const defaultNSFWPolicy = serverConfig.instance.defaultNSFWPolicy

          this.form.patchValue({
            nsfwPolicy: this.user().nsfwPolicy || defaultNSFWPolicy,
            nsfwFlagViolent: this.buildNSFWFormFlag(NSFWFlag.VIOLENT),
            nsfwFlagSex: this.buildNSFWFormFlag(NSFWFlag.EXPLICIT_SEX),

            p2pEnabled: this.user().p2pEnabled,
            autoPlayVideo: this.user().autoPlayVideo === true,
            autoPlayNextVideo: this.user().autoPlayNextVideo,
            videoLanguages: this.user().videoLanguages
          })

          if (this.reactiveUpdate()) this.handleReactiveUpdate()
        }
      )
  }

  ngOnDestroy () {
    this.formValuesWatcher?.unsubscribe()
  }

  private buildForm () {
    const obj: BuildFormArgument = {
      nsfwPolicy: null,
      nsfwFlagViolent: null,
      nsfwFlagSex: null,

      p2pEnabled: null,
      autoPlayVideo: null,
      autoPlayNextVideo: null,
      videoLanguages: null
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

  updateDetails (onlyKeys?: string[]) {
    const videoLanguages = this.form.value.videoLanguages

    if (Array.isArray(videoLanguages)) {
      if (videoLanguages.length > 20) {
        this.notifier.error($localize`Too many languages are enabled. Please enable them all or stay below 20 enabled languages.`)
        return
      }
    }

    const value = this.form.value

    let details: UserUpdateMe = {
      nsfwPolicy: value.nsfwPolicy,
      p2pEnabled: value.p2pEnabled,
      autoPlayVideo: value.autoPlayVideo,
      autoPlayNextVideo: value.autoPlayNextVideo,

      nsfwFlagsDisplayed: this.buildNSFWUpdateFlag('display'),
      nsfwFlagsHidden: this.buildNSFWUpdateFlag('do_not_list'),
      nsfwFlagsWarned: this.buildNSFWUpdateFlag('warn'),
      nsfwFlagsBlurred: this.buildNSFWUpdateFlag('blur'),

      videoLanguages
    }

    if (onlyKeys) {
      const hasNSFWFlags = onlyKeys.includes('nsfwFlagViolent') ||
        onlyKeys.includes('nsfwFlagSex')

      const onlyKeysWithNSFW = hasNSFWFlags
        ? [ ...onlyKeys, 'nsfwFlagsDisplayed', 'nsfwFlagsHidden', 'nsfwFlagsWarned', 'nsfwFlagsBlurred' ]
        : onlyKeys

      details = pick(details, onlyKeysWithNSFW)
    }

    if (this.authService.isLoggedIn()) {
      return this.updateLoggedProfile(details)
    }

    return this.updateAnonymousProfile(details)
  }

  isNsfwFlagsEnabled () {
    return this.serverService.getHTMLConfig().nsfwFlagsSettings.enabled
  }

  private handleReactiveUpdate () {
    let oldForm = { ...this.form.value }

    this.formValuesWatcher = this.form.valueChanges.subscribe((formValue: any) => {
      const updatedKey = Object.keys(formValue)
        .find(k => formValue[k] !== ((oldForm as any)[k]))

      oldForm = { ...this.form.value }

      this.updateDetails([ updatedKey ])
    })
  }

  private updateLoggedProfile (details: UserUpdateMe) {
    this.userService.updateMyProfile(details)
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          if (this.notifyOnUpdate()) this.notifier.success($localize`Video settings updated.`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private updateAnonymousProfile (details: UserUpdateMe) {
    this.userService.updateMyAnonymousProfile(details)

    if (this.notifyOnUpdate()) {
      this.notifier.success($localize`Display/Video settings updated.`)
    }
  }

  private buildNSFWFormFlag (flag: NSFWFlagType): NSFWPolicyType | 'default' {
    const user = this.user()

    if ((user.nsfwFlagsDisplayed & flag) === flag) return 'display'
    if ((user.nsfwFlagsWarned & flag) === flag) return 'warn'
    if ((user.nsfwFlagsBlurred & flag) === flag) return 'blur'
    if ((user.nsfwFlagsHidden & flag) === flag) return 'do_not_list'

    return 'default'
  }

  private buildNSFWUpdateFlag (type: NSFWPolicyType): number {
    let result = NSFWFlag.NONE

    if (this.form.value.nsfwFlagViolent === type) result |= NSFWFlag.VIOLENT
    if (this.form.value.nsfwFlagSex === type) result |= NSFWFlag.EXPLICIT_SEX

    return result
  }

  private updateNSFWDefaultLabel (nsfwPolicy: NSFWPolicyType) {
    const defaultItem = this.nsfwFlagItems.find(item => item.id === 'default')
    const nsfwPolicyLabel = this.nsfwItems.find(i => i.id === nsfwPolicy).label

    defaultItem.label = $localize`Default (${nsfwPolicyLabel})`
  }
}
