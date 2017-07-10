import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'

import { NotificationsService } from 'angular2-notifications'

import { ConfirmService } from '../../../core'
import { validateHost } from '../../../shared'
import { FriendService } from '../shared'

@Component({
  selector: 'my-friend-add',
  templateUrl: './friend-add.component.html',
  styleUrls: [ './friend-add.component.scss' ]
})
export class FriendAddComponent implements OnInit {
  form: FormGroup
  hosts: string[] = [ ]
  error: string = null

  constructor (
    private router: Router,
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private friendService: FriendService
  ) {}

  ngOnInit () {
    this.form = new FormGroup({})
    this.addField()
  }

  addField () {
    this.form.addControl(`host-${this.hosts.length}`, new FormControl('', [ validateHost ]))
    this.hosts.push('')
  }

  canMakeFriends () {
    return window.location.protocol === 'https:'
  }

  customTrackBy (index: number, obj: any): any {
    return index
  }

  displayAddField (index: number) {
    return index === (this.hosts.length - 1)
  }

  displayRemoveField (index: number) {
    return (index !== 0 || this.hosts.length > 1) && index !== (this.hosts.length - 1)
  }

  isFormValid () {
    // Do not check the last input
    for (let i = 0; i < this.hosts.length - 1; i++) {
      if (!this.form.controls[`host-${i}`].valid) return false
    }

    const lastIndex = this.hosts.length - 1
    // If the last input (which is not the first) is empty, it's ok
    if (this.hosts[lastIndex] === '' && lastIndex !== 0) {
      return true
    } else {
      return this.form.controls[`host-${lastIndex}`].valid
    }
  }

  removeField (index: number) {
    // Remove the last control
    this.form.removeControl(`host-${this.hosts.length - 1}`)
    this.hosts.splice(index, 1)
  }

  makeFriends () {
    this.error = ''

    const notEmptyHosts = this.getNotEmptyHosts()
    if (notEmptyHosts.length === 0) {
      this.error = 'You need to specify at least 1 host.'
      return
    }

    if (!this.isHostsUnique(notEmptyHosts)) {
      this.error = 'Hosts need to be unique.'
      return
    }

    const confirmMessage = 'Are you sure to make friends with:<br /> - ' + notEmptyHosts.join('<br /> - ')
    this.confirmService.confirm(confirmMessage, 'Make friends').subscribe(
      res => {
        if (res === false) return

        this.friendService.makeFriends(notEmptyHosts).subscribe(
          status => {
            this.notificationsService.success('Sucess', 'Make friends request sent!')
            this.router.navigate([ '/admin/friends/list' ])
          },

          err => this.notificationsService.error('Error', err.text)
        )
      }
    )
  }

  private getNotEmptyHosts () {
    const notEmptyHosts = []

    Object.keys(this.form.value).forEach((hostKey) => {
      const host = this.form.value[hostKey]
      if (host !== '') notEmptyHosts.push(host)
    })

    return notEmptyHosts
  }

  private isHostsUnique (hosts: string[]) {
    return hosts.every(host => hosts.indexOf(host) === hosts.lastIndexOf(host))
  }
}
