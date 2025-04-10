import { NgIf } from '@angular/common'
import { Component, OnDestroy, OnInit, inject, input } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { AuthService, Notifier, ServerService, User, UserService } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NSFWPolicyType, UserUpdateMe } from '@peertube/peertube-models'
import { pick } from 'lodash-es'
import { Subject, Subscription } from 'rxjs'
import { first } from 'rxjs/operators'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { SelectLanguagesComponent } from '../shared-forms/select/select-languages.component'
import { HelpComponent } from '../shared-main/buttons/help.component'

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
    NgIf
  ]
})
export class UserVideoSettingsComponent extends FormReactive implements OnInit, OnDestroy {
  protected formReactiveService = inject(FormReactiveService)
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private userService = inject(UserService)
  private serverService = inject(ServerService)

  readonly user = input<User>(null)
  readonly reactiveUpdate = input(false)
  readonly notifyOnUpdate = input(true)
  readonly userInformationLoaded = input<Subject<any>>(undefined)

  defaultNSFWPolicy: NSFWPolicyType
  formValuesWatcher: Subscription

  ngOnInit () {
    this.buildForm({
      nsfwPolicy: null,
      p2pEnabled: null,
      autoPlayVideo: null,
      autoPlayNextVideo: null,
      videoLanguages: null
    })

    this.userInformationLoaded().pipe(first())
      .subscribe(
        () => {
          const serverConfig = this.serverService.getHTMLConfig()
          this.defaultNSFWPolicy = serverConfig.instance.defaultNSFWPolicy

          this.form.patchValue({
            nsfwPolicy: this.user().nsfwPolicy || this.defaultNSFWPolicy,
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

  updateDetails (onlyKeys?: string[]) {
    const nsfwPolicy = this.form.value['nsfwPolicy']
    const p2pEnabled = this.form.value['p2pEnabled']
    const autoPlayVideo = this.form.value['autoPlayVideo']
    const autoPlayNextVideo = this.form.value['autoPlayNextVideo']

    const videoLanguages = this.form.value['videoLanguages']

    if (Array.isArray(videoLanguages)) {
      if (videoLanguages.length > 20) {
        this.notifier.error($localize`Too many languages are enabled. Please enable them all or stay below 20 enabled languages.`)
        return
      }
    }

    let details: UserUpdateMe = {
      nsfwPolicy,
      p2pEnabled,
      autoPlayVideo,
      autoPlayNextVideo,
      videoLanguages
    }

    if (videoLanguages) {
      details = Object.assign(details, videoLanguages)
    }

    if (onlyKeys) details = pick(details, onlyKeys)

    if (this.authService.isLoggedIn()) {
      return this.updateLoggedProfile(details)
    }

    return this.updateAnonymousProfile(details)
  }

  private handleReactiveUpdate () {
    let oldForm = { ...this.form.value }

    this.formValuesWatcher = this.form.valueChanges.subscribe((formValue: any) => {
      const updatedKey = Object.keys(formValue)
        .find(k => formValue[k] !== oldForm[k])

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

        error: err => this.notifier.error(err.message)
      })
  }

  private updateAnonymousProfile (details: UserUpdateMe) {
    this.userService.updateMyAnonymousProfile(details)

    if (this.notifyOnUpdate()) {
      this.notifier.success($localize`Display/Video settings updated.`)
    }
  }
}
