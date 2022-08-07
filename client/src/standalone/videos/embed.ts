import './embed.scss'
import '../../assets/player/shared/dock/peertube-dock-component'
import '../../assets/player/shared/dock/peertube-dock-plugin'
import videojs from 'video.js'
//import { peertubeTranslate } from '../../../../shared/core-utils/i18n'
import { HTMLServerConfig, LiveVideo, VideoDetails } from '../../../../shared/models'
import { PeertubePlayerManager } from '../../assets/player'
import { logger } from '../../root-helpers'
import { PeerTubeEmbedApi } from "./api-direct";
import { AuthHTTP, LiveManager, PlayerManagerOptions, VideoFetcher } from './shared'
import { PlayerHTML } from './shared/player-html'
require("videojs-overlay");

export class PeerTubeEmbed {
	player: videojs.Player
	details : VideoDetails
	api: PeerTubeEmbedApi = null
	lightclbk : Function
	pathfunction: any
	config: HTMLServerConfig
	parameters : any
	clbk : any
	//host: string

	private PeertubePlayerManagerModulePromise: Promise<any>

	private readonly http: AuthHTTP
	private readonly videoFetcher: VideoFetcher
	private readonly playerHTML: PlayerHTML
	private readonly playerManagerOptions: PlayerManagerOptions
	private readonly liveManager: LiveManager


	constructor(wrapperElement: HTMLElement) {

		this.http = new AuthHTTP()

		this.videoFetcher = new VideoFetcher(this.http)
		this.playerHTML = new PlayerHTML(wrapperElement)


		this.playerManagerOptions = new PlayerManagerOptions(this.playerHTML, this.videoFetcher)
		this.liveManager = new LiveManager(this.playerHTML)

		/*try {
			this.config = JSON.parse(window['PeerTubeServerConfig'])
		} catch (err) {
			logger.error('Cannot parse HTML config.', err)
		}*/
	}

	static async main(
		element: HTMLElement,
		videoId: string,
		host : string,
		parameters: any,
		clbk: any
	) {
		const embed = new PeerTubeEmbed(element)

		return await embed.init(host, videoId, parameters, clbk).then(() => {
			return Promise.resolve(embed);
		})
	}

	getPlayerElement() {
		return this.playerHTML.getPlayerElement()
	}

	public async getplayer(){

		if (this.lightclbk){
			console.log("ASDADSD")
			await this.lightclbk()
		}

		return this.player
	}

	getScope() {
		return this.playerManagerOptions.getScope()
	}

	// ---------------------------------------------------------------------------

	async init(host: string, videoId: string, parameters: any, clbk : any) {
		this.PeertubePlayerManagerModulePromise = import('../../assets/player/peertube-player-manager')

		if (!videoId || !host) return

		return this.loadVideoAndBuildPlayer(host, videoId, parameters, clbk)
	}

	private initializeApi(clbk : any = {}) {

		if (this.api) {
			this.api.clear()
			this.api.setupStateTracking()
		}
		else {
			this.api = new PeerTubeEmbedApi(this, clbk);
			this.api.initialize();
		}
	}

	/// ?

	/*private correctPath(path: string = '') {

		if (this.pathfunction) return this.pathfunction(path)

		return path
	}

	private composePath(path: string = '') {

		var h = this.host

		if (this.pathfunction) h = this.pathfunction(h)

		else h = 'https://' + h

		return h + path

	}*/

	/*public getelement() {
		var pel = this.playerHTML.getPlayerElement();

		try {
			pel = this.player.tech.el
		} catch (e) { }

		return pel
	}*/

	// ---------------------------------------------------------------------------

	private async loadVideoAndBuildPlayer(host: string, uuid: string, parameters: any, clbk : any) {
		try {
			console.log('host', host, uuid)
			const { videoDetails } = await this.videoFetcher.loadVideoCache(uuid, host)

			videoDetails.host = host

			if (parameters.light){

				return this.buildVideoPlayerLight(videoDetails, async () => {
					await this.buildVideoPlayer(videoDetails, host, parameters, clbk)
				}, parameters);
	
			}

			return this.buildVideoPlayer(videoDetails, host, parameters, clbk)
		} catch (err) {
			this.playerHTML.displayError(err.message/*, await this.translationsPromise*/)
		}
	}

	private async buildVideoPlayerLight(videoDetails: VideoDetails,clbk : Function, parameters : any){
		parameters.lighted = true

		this.initializeApi();

		var poster = this.playerHTML.thumbPlayer(videoDetails)

		poster.addEventListener('click', () => {

			if (this.lightclbk)
				this.lightclbk().then(() => {
					this.player.play()
				})

		})

		this.lightclbk = async () => {

			parameters.lighted = false

			this.lightclbk = null

			await clbk()

		}
	}

	private async buildVideoPlayer(videoDetails: VideoDetails, host : any, parameters: any, clbk : any) {
		const alreadyHadPlayer = this.resetPlayerElement()
		
		const videoInfoPromise: Promise<{ video: VideoDetails, live?: LiveVideo }> = new Promise((resolve, reject) => {
			
			this.details = videoDetails
			this.parameters = parameters
			this.clbk = clbk

			this.playerManagerOptions.loadParams(videoDetails, parameters)

			/*if (!alreadyHadPlayer && !this.playerManagerOptions.hasAutoplay()) {
				this.playerHTML.buildPlaceholder(videoDetails, host)
			}*/

			if (!videoDetails.isLive) {
				return resolve({ video: videoDetails })
			}

			return this.videoFetcher.loadVideoWithLive(videoDetails, host).then(resolve).catch(reject)
		})
		

		const [{ video, live }, PeertubePlayerManagerModule] = await Promise.all([
			videoInfoPromise,
			/*this.translationsPromise,
			captionsPromise,*/
			this.PeertubePlayerManagerModulePromise
		])


		const PlayerManager: typeof PeertubePlayerManager = PeertubePlayerManagerModule.PeertubePlayerManager

		const options = await this.playerManagerOptions.getPlayerOptions({
			video,
			//captionsResponse,
			alreadyHadPlayer,
			//translations,
			serverConfig: this.config,

			onVideoUpdate: (uuid: string, host) => this.loadVideoAndBuildPlayer(host, uuid, parameters, clbk),

			//playNextPlaylistVideo: () => this.playNextPlaylistVideo(),
			//playPreviousPlaylistVideo: () => this.playPreviousPlaylistVideo(),

			live
		})

		this.player = await PlayerManager.initialize(this.playerManagerOptions.getMode(), options, (player: videojs.Player) => {
			this.player = player
		})

		this.player.on('customError', (event: any, data: any) => {
			const message = data?.err?.message || ''
			if (!message.includes('from xs param')) return

			this.player.dispose()
			this.playerHTML.removePlayerElement()
			this.playerHTML.displayError('This video is not available because the remote instance is not responding.')
		})

		//window['videojsPlayer'] = this.player

		//this.buildCSS()
		//this.buildPlayerDock(video)

		const overlayString = '<span class="icon logo-bastyon"></span>';

		this.player.overlay({
			overlays: [
				{
					content: overlayString,
					align: "top-left",
					start: 0,
					showBackground: false,
					class: "pocketnet-logo-video-player",
				},
			],
		});

		if (this.api && this.api.playing){
			this.player.play()
		}

		this.initializeApi(clbk)

		// @ts-ignore
		this.playerHTML.setARElement(video, this.player.el_)

		

		//if (this.isPlaylistEmbed()) {
		//await this.buildPlayerPlaylistUpnext()

		//this.player.playlist().updateSelected()

		/*this.player.on('stopped', () => {
		  this.playNextPlaylistVideo()
		})*/
		//}

		//this.peertubePlugin.getPluginsManager().runHook('action:embed.player.loaded', undefined, { player: this.player, videojs, video })

		if (video.isLive) {
			this.liveManager.displayInfoAndListenForChanges({
				video,
				onPublishedVideo: () => {
					this.liveManager.stopListeningForChanges(video)
					this.loadVideoAndBuildPlayer(video.host, video.uuid, parameters, clbk) //// +
				}
			})
		}
	}

	private resetPlayerElement() {
		let alreadyHadPlayer = false

		if (this.player) {
			this.player.dispose()
			alreadyHadPlayer = true
		}

		const playerElement = document.createElement('video')
		playerElement.className = 'video-js vjs-peertube-skin'
		playerElement.setAttribute('playsinline', 'true')

		this.playerHTML.setPlayerElement(playerElement)
		this.playerHTML.addPlayerElementToDOM()

		return alreadyHadPlayer
	}

	rebuild() {

		this.destroy()

		if (this.details && this.details.uuid) {
			return this.loadVideoAndBuildPlayer(this.details.host, this.details.uuid, this.parameters, this.clbk)
		}

		return Promise.resolve()
	}


	destroy(){
		if (this.player){
			try{this.player.dispose()} catch(e){}
		}

		if (this.api){
			this.api.clear()
		}
	}

}

/*
PeerTubeEmbed.main()
  .catch(err => {
	(window as any).displayIncompatibleBrowser()

	logger.error('Cannot init embed.', err)
  })
*/

// @ts-ignore
window.PeerTubeEmbeding = PeerTubeEmbed;