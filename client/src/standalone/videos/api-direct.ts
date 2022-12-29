import './embed.scss'

//import { PeerTubeResolution, PeerTubeTextTrack } from '../player/definitions'
import { PeerTubeEmbed } from './embed'

/**
 * Embed API exposes control of the embed player to the outside world via
 * JSChannels and window.postMessage
 */
export class PeerTubeEmbedApi {

	savedVolume: number
	state: string
	updateinterval: any
	ignoreChange: boolean

	constructor(private embed: PeerTubeEmbed, private clbk: any) {
		this.ignoreChange = false
	}

	initialize() {

		this.setupStateTracking()

		this.answer({ method: 'ready', params: 'ready' })
	}

	get muted() {

		return this.embed.player.muted()

	}

	set muted(v: boolean) {
		if (v) {
			this.mute()
		}
		else {
			this.unmute()
		}
	}

	get playing() {
		return this.state == 'playing'
	}

	private get element() {
		return this.embed.getPlayerElement()
	}

	public destroy() {

		this.embed.destroy()

		this.clear()

		return true
	}

	public clear() {

		if (this.updateinterval) {
			clearInterval(this.updateinterval)

			this.updateinterval = null
		}

		this.ignoreChange = false
	}

	public async prepare(){
		await this.embed.getplayer()
	}

	public play() {

		if (this.embed && this.embed.details && [2, 5].includes(this.embed.details.state.id)) {
			return
		}

		if(!this.embed.player) return

		var pr =  this.embed.player.play()

		if (pr && pr.catch)

			pr.catch((e: any) => {

				if (e && e.toString) {
					e = e.toString()

					if (e && e.indexOf('removed from the document') > -1) {
						this.destroy()
						return
					}

					/* @ts-ignore */
					if (typeof window.isMobile != 'undefined' && window.isMobile() || window.cordova) return

					if (e && e.indexOf('request was interrupted') > -1) {
						this.mute()

						
						this.embed.player.play().catch(e => {
							
						})
					}


					
				}
			})


	}

	public pause() {
		
		return this.embed.player.pause()
	}

	public stop() {

	

		return this.embed.player.pause()
	}

	public seek(time: any) {
		return this.embed.player.currentTime(time)
	}

	public setVolume(value: any) {

		if (this.getVolume() != value) {
			this.ignoreChange = true
		}

		try {
			if (value) {
				this.embed.player.muted(false)
				return this.embed.player.volume(value)
			}
			else {
				this.embed.player.muted(true)
				return 0
			}
		}
		catch (e) {

		}

	}

	public getVolume() {

		if(!this.embed.player) return 0

		try{
			return this.embed.player.muted() ? 0 : this.embed.player.volume()
		}
		catch(e){
			return 0
		}

		
	}

	public rebuild() {
		var volume = this.getVolume()

		this.state = 'unstarted'
		this.clear()

		return this.embed.rebuild().then(() => {
			this.setVolume(volume)

			return this.stop()
		})

	}

	public requestFullScreen(){
		if (this.embed.player){
			this.embed.player.requestFullscreen()
		}
	}

	public mute() {
		this.savedVolume = this.getVolume()
		this.setVolume(0)
	}

	public unmute() {
		this.setVolume(this.savedVolume || 1)
	}

	public getState() {
		return this.state
	}

	public setPlaybackRate(playbackRate: any) {
		return this.embed.player.playbackRate(playbackRate)
	}

	public getPlaybackRates() {
		return this.embed.player.options_.playbackRates
	}

	public getPosition(){

		return this.embed.player.currentTime()
	}

	public enableHotKeys(){
		if(!this.embed.player) return

			this.embed.player.trigger('enablehotkeys')
	}

	public disableHotKeys(){

		if(!this.embed.player) return
			this.embed.player.trigger('disablehotkeys')
	}

	private answer(obj: any) {
		if (this.clbk[obj.method])
			this.clbk[obj.method](obj.params)
	}

	public send(obj: any){
		this.answer(obj)
	}

	public setupStateTracking() {

		let currentState: 'playing' | 'paused' | 'unstarted' | 'ended' = 'unstarted'

		this.clear()

		if(!this.embed.player) return

		var slf = this

		var player : any = this.embed.player

		var hls : any = null;

		if(typeof player.p2pMediaLoader == 'function') hls = player.p2pMediaLoader().getHLSJS()

		this.updateinterval = setInterval(() => {
			if (!this.element) return

			const position = this.getPosition()
			const volume = this.element.volume

			this.state = currentState

			this.answer({
				method: 'playbackStatusUpdate',
				params: {
					position,
					volume,
					duration: this.embed.player.duration(),
					playbackState: currentState,

					bandwidthEstimate : hls.bandwidthEstimate
				}
			})
		}, 500)

		

		if (hls){

			hls.on('hlsError', (event : any, data : any) => {

				if (data.fatal){
					slf.answer({ 
						method: 'error', 
						params: {
							data : data,
							message: `HLS.js error: ${data.type} - fatal: ${data.fatal} - ${data.details}; Q:${this.embed.player.p2pMediaLoader().getHLSJS().currentLevel || 'undefined'}`
						}
					})
				}

			})
		}

		this.embed.player.on('pictureInPictureRequest', function (ev: any) {
			slf.answer({ method: 'pictureInPictureRequest' })
		})
		
		this.embed.player.on('error', () => {

			if (this.embed.player.error){
				var error = this.embed.player.error()

				if (error){
					slf.answer({ 
						method: 'error', 
						params: {
							error
						}
					})
				}
			}
			

			

		})

		this.embed.player.on('play', function (ev: any) {

			if (hls){
				hls.capLevelController.pause = false
			}
			
			currentState = 'playing'
			slf.answer({ method: 'playbackStatusChange', params: 'playing' })
			slf.answer({ method: 'play', params: true })
		})

		this.embed.player.on('pause', function (ev: any) {

			if (hls){
				hls.capLevelController.pause = true
			}

			currentState = 'paused'
			slf.answer({ method: 'playbackStatusChange', params: 'paused' })
			slf.answer({ method: 'pause', params: true })
		})

		this.embed.player.on('ended', function (ev: any) {
			
			if (hls){
				hls.capLevelController.pause = true
			}

			currentState = 'ended'
			slf.answer({ method: 'playbackStatusChange', params: 'ended' })
			slf.answer({ method: 'pause', params: true })
		})

		this.embed.player.on('fullscreenchange', () => {

			this.answer({
				method: 'fullscreenchange',
				params: this.embed.player.isFullscreen()
			})

		})

		/*this.embed.player.tech({ IWillNotUseThisInPlugins: true }).el().addEventListener('webkitendfullscreen', () => {
			this.answer({
				method: 'fullscreenchange',
				params: false
			})
		})*/

		/*this.embed.player.on("webkitendfullscreen", function(){
			videoExitedFullscreen(video);
		}, false);*/

		this.embed.player.on('volumechange', () => {

			if (this.ignoreChange) {
				this.ignoreChange = false
				return
			}

			this.answer({
				method: 'volumeChange',
				params: this.getVolume()
			})

		})

	}

	public isWebtorrent() {
		return false
	}
}
