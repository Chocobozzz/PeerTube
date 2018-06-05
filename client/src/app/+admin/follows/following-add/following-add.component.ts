import { Component } from '@angular/core'
import { Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { ConfirmService } from '../../../core'
import { validateHost } from '../../../shared'
import { FollowService } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-following-add',
  templateUrl: './following-add.component.html',
  styleUrls: [ './following-add.component.scss' ]
})
export class FollowingAddComponent {
  hostsString = ''
  hostsError: string = null
  error: string = null

  constructor (
    private router: Router,
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private followService: FollowService,
    private i18n: I18n
  ) {}

  httpEnabled () {
    return window.location.protocol === 'https:'
  }

  onHostsChanged () {
    this.hostsError = null

    const newHostsErrors = []
    const hosts = this.getNotEmptyHosts()

    for (const host of hosts) {
      if (validateHost(host) === false) {
        newHostsErrors.push(this.i18n('{{host}} is not valid', { host }))
      }
    }

    if (newHostsErrors.length !== 0) {
      this.hostsError = newHostsErrors.join('. ')
    }
  }

  async addFollowing () {
    this.error = ''

    const hosts = this.getNotEmptyHosts()
    if (hosts.length === 0) {
      this.error = this.i18n('You need to specify hosts to follow.')
    }

    if (!this.isHostsUnique(hosts)) {
      this.error = this.i18n('Hosts need to be unique.')
      return
    }

    const confirmMessage = this.i18n('If you confirm, you will send a follow request to:<br /> - ') + hosts.join('<br /> - ')
    const res = await this.confirmService.confirm(confirmMessage, this.i18n('Follow new server(s)'))
    if (res === false) return

    this.followService.follow(hosts).subscribe(
      () => {
        this.notificationsService.success(this.i18n('Success'), this.i18n('Follow request(s) sent!'))

        setTimeout(() => this.router.navigate([ '/admin/follows/following-list' ]), 500)
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  private isHostsUnique (hosts: string[]) {
    return hosts.every(host => hosts.indexOf(host) === hosts.lastIndexOf(host))
  }

  private getNotEmptyHosts () {
    return this.hostsString
      .split('\n')
      .filter(host => host && host.length !== 0) // Eject empty hosts
  }
}
