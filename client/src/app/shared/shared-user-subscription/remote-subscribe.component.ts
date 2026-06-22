import { Component, OnInit, inject, input, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { logger } from '@root-helpers/logger'
import { isIOS } from '@root-helpers/web-browser'
import { USER_HANDLE_VALIDATOR } from '../form-validators/user-validators'
import { HelpComponent } from '../shared-main/buttons/help.component'

@Component({
  selector: 'my-remote-subscribe',
  templateUrl: './remote-subscribe.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, ReactiveFormsModule, HelpComponent ]
})
export class RemoteSubscribeComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private notifier = inject(Notifier)

  readonly uri = input<string>(undefined)
  readonly interact = input(false)
  readonly showHelp = input(false)

  ngOnInit () {
    this.buildForm({
      text: USER_HANDLE_VALIDATOR
    })
  }

  onValidKey () {
    this.forceCheck()
    if (!this.form.valid) return

    this.formValidated()
  }

  formValidated () {
    let address = this.form.value['text'] || ''
    address = address.replace(/^@/, '')

    const [ username, hostname ] = address.split('@')

    this.getSubscribeTemplateUrl({ username, hostname })
      .then(template => {
        if (template.includes('{uri}')) {
          return template.replace('{uri}', encodeURIComponent(this.uri()))
        }

        throw new Error('No subscribe template in webfinger response')
      })
      .then(url => {
        // Ensure the URL is valid
        const parsed = new URL(url)

        if (isIOS()) return window.location.href = parsed.toString()

        return window.open(parsed.toString())
      })
      .catch(err => {
        logger.error(err)

        this.notifier.error($localize`Cannot fetch information of this remote account`)
      })
  }

  private async getSubscribeTemplateUrl (options: {
    username: string
    hostname: string
  }) {
    const webfingerUrl = await this.getWebfingerUrl(options)
    const data = await this.fetchWebfinger(webfingerUrl)

    return this.extractSubscribeTemplate(data)
  }

  private async getWebfingerUrl (options: {
    username: string
    hostname: string
  }) {
    const { username, hostname } = options

    try {
      const hostMetaUrl = `https://${hostname}/.well-known/host-meta`
      const hostMetaTemplate = await this.fetchHostMetaTemplate(hostMetaUrl)

      const resource = `acct:${username}@${hostname}`

      return hostMetaTemplate.replace('{uri}', encodeURIComponent(resource))
    } catch (err) {
      logger.info('Cannot get webfinger URL', err)

      return `https://${hostname}/.well-known/webfinger?resource=acct:${username}@${hostname}`
    }
  }

  private async fetchWebfinger (url: string) {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Webfinger request failed')

    return response.json()
  }

  private extractSubscribeTemplate (data: any) {
    if (!data || Array.isArray(data.links) === false) {
      throw new Error('Not links in webfinger response')
    }

    const link: { template: string } = data.links.find((entry: any) => {
      return entry && typeof entry.template === 'string' && entry.rel === 'http://ostatus.org/schema/1.0/subscribe'
    })

    if (!link?.template) throw new Error('No subscribe template in webfinger response')

    return link.template
  }

  private async fetchHostMetaTemplate (url: string) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/xrd+xml, application/xml;q=0.9, text/xml;q=0.8'
      }
    })

    if (!response.ok) throw new Error('Host-meta request failed')

    const xml = await response.text()

    const linkWithTemplateRegexp = /<Link\b[^>]*\brel=(?:"|')lrdd(?:"|')[^>]*\btemplate=(?:"|')([^"']+)(?:"|')[^>]*\/?>/i
    const match = xml.match(linkWithTemplateRegexp)
    const template = match?.[1]

    if (!template?.includes('{uri}')) {
      throw new Error('No host-meta lrdd template found')
    }

    return template
  }
}
