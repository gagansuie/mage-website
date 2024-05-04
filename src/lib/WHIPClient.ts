import negotiateConnectionWithClientOffer from '$lib/negotiateConnectionWithClientOffer'
import { getAudioIndicator } from '$lib/utils'

/**
 * Example implementation of a client that uses WHIP to broadcast video over WebRTC
 *
 * https://www.ietf.org/archive/id/draft-ietf-wish-whip-01.html
 */
export default class WHIPClient extends EventTarget {
	public peerConnection: RTCPeerConnection
	public localStream?: MediaStream

	constructor(
		private endpoint: string,
		private videoElement: any,
		private trackType: string
	) {
		super()
		/**
		 * Create a new WebRTC connection, using public STUN servers with ICE,
		 * allowing the client to disover its own IP address.
		 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols#ice
		 */
		this.peerConnection = new RTCPeerConnection({
			iceServers: [
				{
					urls: 'stun:stun.cloudflare.com:3478'
				}
			],
			bundlePolicy: 'max-bundle'
		})

		/**
		 * Listen for negotiationneeded events, and use WHIP as the signaling protocol to establish a connection
		 *
		 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/negotiationneeded_event
		 * https://www.ietf.org/archive/id/draft-ietf-wish-whip-01.html
		 */
		this.peerConnection.addEventListener('negotiationneeded', async () => {
			console.log('Connection negotiation starting')
			await negotiateConnectionWithClientOffer(this.peerConnection, this.endpoint)
			console.log('Connection negotiation ended')
		})

		/**
		 * While the connection is being initialized,
		 * connect the video stream to the provided <video> element.
		 */
		this.accessLocalMediaSources(trackType)
			.then((stream: any) => {
				this.localStream = stream
				videoElement.srcObject = stream
			})
			.catch(() => {
				this.disconnectStream()
			})
	}

	/**
	 * Ask for camera and microphone permissions and
	 * add video and audio tracks to the peerConnection.
	 *
	 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	 */
	private async accessLocalMediaSources(trackType: string) {
		if (trackType === 'screen') {
			return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then((stream) => {
				if (!stream.getAudioTracks().length) {
					const audioContext = new AudioContext()
					const oscillator = audioContext.createOscillator()
					const destination = audioContext.createMediaStreamDestination()
					oscillator.connect(destination)
					oscillator.frequency.setValueAtTime(0, audioContext.currentTime)
					oscillator.start()
					const audioTrack = destination.stream.getAudioTracks()[0]
					audioTrack.enabled = true
					this.peerConnection.addTransceiver(audioTrack, {
						direction: 'sendonly'
					})
				}
				stream.getTracks().forEach((track) => {
					const transceiver = this.peerConnection.addTransceiver(track, {
						/** WHIP is only for sending streaming media */
						direction: 'sendonly'
					})
					if (track.kind == 'video' && transceiver.sender.track) {
						transceiver.sender.track.applyConstraints({
							width: 1920,
							height: 1080
						})
					}
				})
				stream.getVideoTracks()[0].addEventListener('ended', () => this.disconnectStream())
				if (stream.getVideoTracks()[0].readyState === 'live') {
					this.dispatchEvent(new CustomEvent(`isScreenLive`, { detail: true }))
				}
				return stream
			})
		} else if (trackType === 'webcam') {
			return navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((stream) => {
				stream.getTracks().forEach((track) => {
					const transceiver = this.peerConnection.addTransceiver(track, {
						/** WHIP is only for sending streaming media */
						direction: 'sendonly'
					})
					if (track.kind == 'video' && transceiver.sender.track) {
						transceiver.sender.track.applyConstraints({
							width: 1280,
							height: 720
						})
					}
				})
				stream.getVideoTracks()[0].addEventListener('ended', () => this.disconnectStream())
				return stream
			})
		} else if (trackType === 'audio') {
			return navigator.mediaDevices
				.getUserMedia({
					video: false,
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						deviceId: 'default'
					}
				})
				.then((stream) => {
					stream.getTracks().forEach((track) => {
						this.peerConnection.addTransceiver(track, {
							/** WHIP is only for sending streaming media */
							direction: 'sendonly'
						})
					})
					stream.getAudioTracks()[0].addEventListener('ended', () => {
						this.disconnectStream()
					})
					getAudioIndicator(stream, this)
					return stream
				})
		}
	}

	/**
	 * Terminate the streaming session
	 * 1. Notify the WHIP server by sending a DELETE request
	 * 2. Close the WebRTC connection
	 * 3. Stop using the local camera and microphone
	 *
	 * Note that once you call this method, this instance of this WHIPClient cannot be reused.
	 */
	public async disconnectStream() {
		await fetch(this.endpoint, {
			method: 'DELETE',
			mode: 'cors'
		})
		this.peerConnection.close()
		this.localStream?.getTracks().forEach((track) => track.stop())
		this.videoElement.srcObject = null
		this.dispatchEvent(new CustomEvent(`localStreamStopped-${this.trackType}`))
		console.log('Disconnected')
	}
}
