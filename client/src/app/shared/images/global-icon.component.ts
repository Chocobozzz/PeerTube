import { ChangeDetectionStrategy, Component, ElementRef, Input, OnInit } from '@angular/core'
import { HooksService } from '@app/core/plugins/hooks.service'

const icons = {
  'add': require('!!raw-loader?!../../../assets/images/global/add.svg').default,
  'user': require('!!raw-loader?!../../../assets/images/global/user.svg').default,
  'sign-out': require('!!raw-loader?!../../../assets/images/global/sign-out.svg').default,
  'syndication': require('!!raw-loader?!../../../assets/images/global/syndication.svg').default,
  'help': require('!!raw-loader?!../../../assets/images/global/help.svg').default,
  'sparkle': require('!!raw-loader?!../../../assets/images/global/sparkle.svg').default,
  'alert': require('!!raw-loader?!../../../assets/images/global/alert.svg').default,
  'cloud-error': require('!!raw-loader?!../../../assets/images/global/cloud-error.svg').default,
  'clock': require('!!raw-loader?!../../../assets/images/global/clock.svg').default,
  'user-add': require('!!raw-loader?!../../../assets/images/global/user-add.svg').default,
  'no': require('!!raw-loader?!../../../assets/images/global/no.svg').default,
  'cloud-download': require('!!raw-loader?!../../../assets/images/global/cloud-download.svg').default,
  'undo': require('!!raw-loader?!../../../assets/images/global/undo.svg').default,
  'history': require('!!raw-loader?!../../../assets/images/global/history.svg').default,
  'circle-tick': require('!!raw-loader?!../../../assets/images/global/circle-tick.svg').default,
  'cog': require('!!raw-loader?!../../../assets/images/global/cog.svg').default,
  'download': require('!!raw-loader?!../../../assets/images/global/download.svg').default,
  'go': require('!!raw-loader?!../../../assets/images/menu/go.svg').default,
  'edit': require('!!raw-loader?!../../../assets/images/global/edit.svg').default,
  'im-with-her': require('!!raw-loader?!../../../assets/images/global/im-with-her.svg').default,
  'delete': require('!!raw-loader?!../../../assets/images/global/delete.svg').default,
  'server': require('!!raw-loader?!../../../assets/images/global/server.svg').default,
  'cross': require('!!raw-loader?!../../../assets/images/global/cross.svg').default,
  'validate': require('!!raw-loader?!../../../assets/images/global/validate.svg').default,
  'tick': require('!!raw-loader?!../../../assets/images/global/tick.svg').default,
  'repeat': require('!!raw-loader?!../../../assets/images/global/repeat.svg').default,
  'inbox-full': require('!!raw-loader?!../../../assets/images/global/inbox-full.svg').default,
  'dislike': require('!!raw-loader?!../../../assets/images/video/dislike.svg').default,
  'support': require('!!raw-loader?!../../../assets/images/video/support.svg').default,
  'like': require('!!raw-loader?!../../../assets/images/video/like.svg').default,
  'more-horizontal': require('!!raw-loader?!../../../assets/images/global/more-horizontal.svg').default,
  'more-vertical': require('!!raw-loader?!../../../assets/images/global/more-vertical.svg').default,
  'share': require('!!raw-loader?!../../../assets/images/video/share.svg').default,
  'upload': require('!!raw-loader?!../../../assets/images/video/upload.svg').default,
  'playlist-add': require('!!raw-loader?!../../../assets/images/video/playlist-add.svg').default,
  'play': require('!!raw-loader?!../../../assets/images/global/play.svg').default,
  'playlists': require('!!raw-loader?!../../../assets/images/global/playlists.svg').default,
  'globe': require('!!raw-loader?!../../../assets/images/menu/globe.svg').default,
  'home': require('!!raw-loader?!../../../assets/images/menu/home.svg').default,
  'recently-added': require('!!raw-loader?!../../../assets/images/menu/recently-added.svg').default,
  'trending': require('!!raw-loader?!../../../assets/images/menu/trending.svg').default,
  'video-lang': require('!!raw-loader?!../../../assets/images/global/video-lang.svg').default,
  'videos': require('!!raw-loader?!../../../assets/images/global/videos.svg').default,
  'folder': require('!!raw-loader?!../../../assets/images/global/folder.svg').default,
  'subscriptions': require('!!raw-loader?!../../../assets/images/menu/subscriptions.svg').default,
  'language': require('!!raw-loader?!../../../assets/images/menu/language.svg').default,
  'unsensitive': require('!!raw-loader?!../../../assets/images/menu/eye.svg').default,
  'sensitive': require('!!raw-loader?!../../../assets/images/menu/eye-closed.svg').default,
  'p2p': require('!!raw-loader?!../../../assets/images/menu/p2p.svg').default,
  'users': require('!!raw-loader?!../../../assets/images/global/users.svg').default,
  'search': require('!!raw-loader?!../../../assets/images/global/search.svg').default,
  'refresh': require('!!raw-loader?!../../../assets/images/global/refresh.svg').default,
  'npm': require('!!raw-loader?!../../../assets/images/global/npm.svg').default,
  'fullscreen': require('!!raw-loader?!../../../assets/images/global/fullscreen.svg').default,
  'exit-fullscreen': require('!!raw-loader?!../../../assets/images/global/exit-fullscreen.svg').default
}

export type GlobalIconName = keyof typeof icons

@Component({
  selector: 'my-global-icon',
  template: '',
  styleUrls: [ './global-icon.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobalIconComponent implements OnInit {
  @Input() iconName: GlobalIconName

  constructor (
    private el: ElementRef,
    private hooks: HooksService
  ) { }

  async ngOnInit () {
    const nativeElement = this.el.nativeElement as HTMLElement
    nativeElement.innerHTML = await this.hooks.wrapFun(
      this.getSVGContent.bind(this),
      { name: this.iconName },
      'common',
      'filter:internal.common.svg-icons.get-content.params',
      'filter:internal.common.svg-icons.get-content.result'
    )
  }

  private getSVGContent (options: { name: string }) {
    return icons[options.name]
  }
}
