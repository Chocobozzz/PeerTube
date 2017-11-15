import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'

import { NotificationsService } from 'angular2-notifications'

import { ConfirmService } from '../../../core'
import { validateHost } from '../../../shared'
import { FollowService } from '../shared'

@Component({
  selector: 'my-following-add',
  templateUrl: './following-add.component.html',
  styleUrls: [ './following-add.component.scss' ]
})
export class FollowingAddComponent implements OnInit {
  form: FormGroup
  hosts: string[] = [ ]
  error: string = null

  constructor (
    private router: Router,
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private followService: FollowService
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

  addFollowing () {
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
    this.confirmService.confirm(confirmMessage, 'Follow new server(s)').subscribe(
      res => {
        if (res === false) return

        this.followService.follow(notEmptyHosts).subscribe(
          status => {
            this.notificationsService.success('Success', 'Follow request(s) sent!')
            // Wait requests between pods
            setTimeout(() => this.router.navigate([ '/admin/friends/list' ]), 1000)
          },

          err => this.notificationsService.error('Error', err.message)
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
