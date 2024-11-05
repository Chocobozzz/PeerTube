import { Component, ElementRef, Input, OnChanges, OnInit, ViewChild, booleanAttribute, numberAttribute } from '@angular/core'
import { Account } from '../shared-main/account/account.model'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { RouterLink } from '@angular/router'
import { NgIf, NgClass, NgTemplateOutlet } from '@angular/common'
import { VideoChannel } from '../shared-main/channel/video-channel.model'

export type ActorAvatarInput = {
  name: string
  avatars: { width: number, url?: string, path: string }[]
}

@Component({
  selector: 'my-actor-avatar',
  styleUrls: [ './actor-avatar.component.scss' ],
  templateUrl: './actor-avatar.component.html',
  standalone: true,
  imports: [ NgIf, NgClass, NgTemplateOutlet, RouterLink ]
})
export class ActorAvatarComponent implements OnInit, OnChanges {
  @ViewChild('avatarEl') avatarEl: ElementRef

  @Input() actor: ActorAvatarInput
  @Input() actorType: 'channel' | 'account' | 'unlogged'

  @Input() previewImage: string

  @Input({ transform: numberAttribute }) size = 120
  @Input({ transform: booleanAttribute }) responseSize = false

  // Use an external link
  @Input() href: string
  // Use routerLink
  @Input() internalHref: string | any[]

  private _title: string

  @Input() set title (value) {
    this._title = value
  }

  get title () {
    if (this._title) return this._title
    if (this.isAccount()) return $localize`${this.actor.name} (account page)`
    if (this.isChannel()) return $localize`${this.actor.name} (channel page)`

    return ''
  }

  classes: string[] = []
  defaultAvatarUrl: string
  avatarUrl: string

  constructor (private el: ElementRef) {

  }

  ngOnInit () {
    this.buildDefaultAvatarUrl()

    this.buildAvatarUrl()
    this.buildClasses()
  }

  ngOnChanges () {
    this.buildAvatarUrl()
    this.buildClasses()
  }

  private buildClasses () {
    let avatarSize = '100%'
    let fontSize = '22px'

    this.classes = [ 'avatar' ]

    if (this.size && !this.responseSize) {
      avatarSize = `${this.size}px`

      if (this.size <= 18) {
        fontSize = '13px'
      } else if (this.size >= 100) {
        fontSize = '40px'
      } else if (this.size >= 120) {
        fontSize = '46px'
      }
    }

    if (this.isChannel()) {
      this.classes.push('channel')
    } else {
      this.classes.push('account')
    }

    // No avatar, use actor name initial
    if (this.displayActorInitial()) {
      this.classes.push('initial')
      this.classes.push(this.getColorTheme())
    }

    const elStyle = (this.el.nativeElement as HTMLElement).style
    elStyle.setProperty('--co-avatar-size', avatarSize)
    elStyle.setProperty('--co-font-size', fontSize)
  }

  private buildDefaultAvatarUrl () {
    this.defaultAvatarUrl = this.isChannel()
      ? VideoChannel.GET_DEFAULT_AVATAR_URL(this.getSizeNumber())
      : Account.GET_DEFAULT_AVATAR_URL(this.getSizeNumber())
  }

  private buildAvatarUrl () {
    if (!this.actor) {
      this.avatarUrl = ''
      return
    }

    if (this.isAccount()) {
      this.avatarUrl = Account.GET_ACTOR_AVATAR_URL(this.actor, this.getSizeNumber())
      return
    }

    if (this.isChannel()) {
      this.avatarUrl = VideoChannel.GET_ACTOR_AVATAR_URL(this.actor, this.getSizeNumber())
      return
    }

    this.avatarUrl = ''
  }

  displayImage () {
    if (this.actorType === 'unlogged') return true
    if (this.previewImage) return true

    return !!(this.actor && this.avatarUrl)
  }

  displayActorInitial () {
    return !this.displayImage() && this.actor && !this.avatarUrl
  }

  displayPlaceholder () {
    return this.actorType !== 'unlogged' && !this.actor
  }

  getActorInitial () {
    const name = this.actor?.name
    if (!name) return ''

    return name.slice(0, 1)
  }

  private isAccount () {
    return this.actorType === 'account'
  }

  private isChannel () {
    return this.actorType === 'channel'
  }

  private getSizeNumber () {
    if (this.size) return +this.size

    return undefined
  }

  private getColorTheme () {
    const initialLowercase = this.getActorInitial().toLowerCase()

    // Keep consistency with CSS
    const themes = {
      '0123456789abc': 'blue',
      'def': 'green',
      'ghi': 'purple',
      'jkl': 'gray',
      'mno': 'yellow',
      'pqr': 'orange',
      'stvu': 'red',
      'wxyz': 'dark-blue'
    }

    const theme = objectKeysTyped(themes)
      .find(chars => chars.includes(initialLowercase))

    return themes[theme] || 'blue'
  }
}
