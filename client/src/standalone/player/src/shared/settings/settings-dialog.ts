import videojs from 'video.js'
import { VideojsComponent, VideojsPlayer } from '../../types'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

class SettingsDialog extends Component {
  constructor (player: VideojsPlayer) {
    super(player)

    this.hide()
  }

  /**
   * Create the component's DOM element
   */
  createEl () {
    const uniqueId = this.player().id()
    const dialogLabelId = 'TTsettingsDialogLabel-' + uniqueId
    const dialogDescriptionId = 'TTsettingsDialogDescription-' + uniqueId

    return super.createEl('div', {
      className: 'vjs-settings-dialog vjs-modal-overlay',
      id: 'vjs-settings-dialog-' + uniqueId,
      tabIndex: -1
    }, {
      'role': 'dialog',
      'aria-labelledby': dialogLabelId,
      'aria-describedby': dialogDescriptionId
    })
  }

  show () {
    this.player().addClass('vjs-settings-dialog-opened')

    super.show()
  }

  hide () {
    this.player().removeClass('vjs-settings-dialog-opened')

    super.hide()
  }
}

videojs.registerComponent('SettingsDialog', SettingsDialog)

export { SettingsDialog }
