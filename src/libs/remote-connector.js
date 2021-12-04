import EventEmitter from 'events'
import moment from 'moment'

export default class RemoteConnector extends EventEmitter {
  _pc1 = null
  _pc2 = null
  _pcConfig = {}


  /**
   * 
   * @returns {RemoteConnector}
   */
  static create(){
    return new this()
  }

  /**
   * check settings of audio track, then emit result.
   * It will be used for UI update on rendering part.
   * 
   */
  checkAudioSettings = () => {
    const [ sender ] = this._pc1.getSenders()
    const settings = sender.track.getSettings()

    const _settings = {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression
    }

    this.emit( 'update:settings', _settings )
    this.emit( 'deviceName', this._getDeviceName() )
  }

  /**
   * change audio settings of `echoCancellation` and
   * `noiseSuppression`. Since track.applyConstraints()
   * does not work for these constraints, I used 
   * create new Stream with above constraints, then
   * sender.replaceTrack(). Since this method does not
   * need re-negotiation.
   * I also mention that calling `sender.track.stop()`
   * before replaceTrack() is important to terminate 
   * previous audio track. When this method is not called, 
   * some unstable behavior has been observed on Chrome.
   * 
   * @param {object} settings 
   * @param {boolean} [echoCancellation]
   * @param {boolean} [noiseSuppression]
   */
  changeSettings = async settings => {
    const [ sender ] = this._pc1.getSenders()
    const currentSettings = sender.track.getSettings()

    sender.track.stop()

    const _settings = Object.assign( {}, {
      echoCancellation: currentSettings.echoCancellation,
      noiseSuppression: currentSettings.noiseSuppression
    }, settings )

    const stream = await this._getStream( _settings )

    const [ newTrack ] = stream.getAudioTracks()

    await sender.replaceTrack( newTrack )

    this.checkAudioSettings()
  }

  /**
   * 
   */
  start = async () => {
    const stream = await this._getStream()
    await this._connectRtc( stream )
    console.log( 'WebRTC connection established.')
  }

  /**
   * 
   */
  stop = () => {
    if( this._pc1 ) {
      const senders = this._pc1.getSenders()

      for( const sender of senders ) {
        sender.track.stop()
      }

      this._pc1.close()
      this._pc1 = null
    }
    if( this._pc2 ) {
      this._pc2.close()
      this._pc2 = null
    }
  }

  /**
   * 
   * @param {MediaStream} stream 
   */
  _connectRtc = async ( stream ) => {
    try {
      // create RTCPeerConnection instance for both peer
      //
      this._pc1 = new RTCPeerConnection( this._pcConfig )
      this._emitLog( "pc1", "created RTCPeerConnection" )

      this._pc2 = new RTCPeerConnection( this._pcConfig )
      this._emitLog( "pc2", "created RTCPeerConnection" )

      // set icecandidate handlers for both peer
      //
      this._pc1.addEventListener('icecandidate', ev => {
        this._emitLog( "pc1", "generated icecandidate" )

        this._pc2.addIceCandidate( ev.candidate )
        this._emitLog( "pc2", "added icecandidate" )
      })
      this._pc2.addEventListener('icecandidate', ev => {
        this._emitLog( "pc2", "generated icecandidate" )

        this._pc1.addIceCandidate( ev.candidate )
        this._emitLog( "pc1", "added icecandidate" )
      })

      // handle media track transmitted by other peer.
      //
      this._pc2.addEventListener('track', ev => {
        this._emitLog( "pc2", "track received" )
        this.emit( 'track', ev.track )

        this.checkAudioSettings()
      })

      // se4t one-way negotiation ( pc1 -> pc2 )
      //
      const transceiver1 = this._pc1.addTransceiver('audio')
      transceiver1.direction = 'sendonly'
      const transceiver2 = this._pc2.addTransceiver('audio')
      transceiver2.direction = 'recvonly'

      // set source audio track on pc1
      //
      stream.getTracks().forEach( track => this._pc1.addTrack( track ))
      this._emitLog( "pc1", "track added" )

      // handle offer description
      //
      const offer = await this._pc1.createOffer()
      this._emitLog( "pc1", "generated offer description" )

      await this._pc1.setLocalDescription( offer )
      this._emitLog( "pc1", "setLocalDescription( offer )" )

      await this._pc2.setRemoteDescription( offer )
      this._emitLog( "pc2", "setRemoteDescription( offer )" )

      // handle answer description
      //
      const answer = await this._pc2.createAnswer()
      this._emitLog( "pc2", "generated answer description" )

      await this._pc2.setLocalDescription( answer )
      this._emitLog( "pc2", "setLocalDescription( answer )" )

      await this._pc1.setRemoteDescription( answer )
      this._emitLog( "pc1", "setRemoteDescription( answer )" )

    } catch(err) {
      this._emitLog( "error", err.message )
    }
  }

  _getDeviceName = () => {
    const [ sender ] = this._pc1.getSenders()

    return sender.track.label
  }
 
  /**
   * 
   * @param {string} label - arbitrary string for label
   * @param {string} message - message
   */
  _emitLog( label, message ) {
    const timestamp = moment().format("HH:mm:ss.SSS")

    this.emit("log", {
      timestamp, label, message
    })
  }

  /**
   * 
   * @param {object} [settings]
   * @param {boolean} echoCancellation
   * @param {boolean} noiseSuppression
   */
  _getStream = async ( settings ) => {
    const _settings = settings || true

    return await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: _settings
    })
  }
}