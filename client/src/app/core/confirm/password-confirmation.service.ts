import { Injectable, inject } from '@angular/core'
import { ServerErrorCode } from '@peertube/peertube-models'
import { Observable, filter, from, switchMap, throwError } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { AuthService } from '../auth/auth.service'
import { Notifier } from '../notification/notifier.service'
import { ServerService } from '../server/server.service'
import { ConfirmService } from './confirm.service'

@Injectable()
export class PasswordConfirmationService {
  private auth = inject(AuthService)
  private confirmService = inject(ConfirmService)
  private notifier = inject(Notifier)
  private server = inject(ServerService)

  async askPassword (options: {
    title: string
    message: string

    // Show a classic confirm modal with the same message if the password is not required
    confirmIfNotRequired?: boolean
  }): Promise<{ confirmed: boolean, currentPassword?: string }> {
    const { title, message, confirmIfNotRequired = false } = options

    if (!this.isRequired()) {
      if (!confirmIfNotRequired) return { confirmed: true }

      return { confirmed: await this.confirmService.confirm(message, title) }
    }

    if (!this.canConfirmPassword()) {
      this.notifier.error(
        // eslint-disable-next-line max-len
        $localize`This action requires a password confirmation, but your account uses an external authentication. Ask your system administrator to disable security.password_confirmation in the configuration file.`
      )

      return { confirmed: false }
    }

    const { confirmed, password } = await this.confirmService.confirmWithPassword({
      title,
      message: message + ' ' + $localize`Please type your password to confirm.`
    })

    return { confirmed, currentPassword: password }
  }

  // Ask the password first if `required`, then run the request. If the server says the password is missing, retry the request
  runWithPassword<T> (options: {
    title: string
    message: string
    required: boolean
    request: (currentPassword?: string) => Observable<T>
  }): Observable<T> {
    const { title, message, required, request } = options

    const askAndRun = () => {
      return from(this.askPassword({ title, message }))
        .pipe(
          filter(({ confirmed }) => confirmed),
          switchMap(({ currentPassword }) => request(currentPassword))
        )
    }

    if (required) return askAndRun()

    return request()
      .pipe(
        catchError(err => {
          if (err.body?.code !== ServerErrorCode.CURRENT_PASSWORD_IS_MISSING) return throwError(() => err)

          return askAndRun()
        })
      )
  }

  buildErrorMessage (err: { message: string, body?: any }) {
    if (err.body?.code === ServerErrorCode.CURRENT_PASSWORD_IS_INVALID) {
      return $localize`Please check your password and try again.`
    }

    return err.message
  }

  handleError (err: Error & { body?: any }) {
    if (err.body?.code === ServerErrorCode.CURRENT_PASSWORD_IS_INVALID) {
      return this.notifier.error(this.buildErrorMessage(err), $localize`Password not recognized`)
    }

    return this.notifier.handleError(err)
  }

  private isRequired () {
    return this.server.getHTMLConfig().security.passwordConfirmation.enabled
  }

  // Users of an external auth plugin (OpenID, SAML...) don't have a password PeerTube can check
  private canConfirmPassword () {
    const user = this.auth.getUser()
    if (!user.pluginAuth) return true

    return this.server.getHTMLConfig().plugin.registeredIdAndPassAuths.some(a => a.npmName === user.pluginAuth)
  }
}
