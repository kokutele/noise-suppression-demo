import EventEmitter from 'events'

export default class AudioAnalyser extends EventEmitter {
  _audioCtx = null
  _timeDomainAnalyser = null
  _freqDomainAnalyser = null
  _timeDomainArray = null
  _freqDomainArray = null 
  _reqId = null

  _canvas = null
  _canvasCtx = null

  constructor() {
    super()

    this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * 
   * @param {MediaStream} stream 
   * @param {HTMLCanvasElement} canvas
   */
  start( stream, canvas ) {
    this._canvas = canvas
    this._canvasCtx = this._canvas.getContext('2d')

    const source = this._audioCtx.createMediaStreamSource( stream )
    this._timeDomainAnalyser = this._audioCtx.createAnalyser()
    this._frequencyAnalyser = this._audioCtx.createAnalyser()

    source.connect( this._timeDomainAnalyser )
    source.connect( this._frequencyAnalyser )
    // be sure that no `connect(ctx.destination)` is not needed
    // when just analyzing audio.

    this._timeDomainAnalyser.fftSize = 2048
    this._frequencyAnalyser.fftSize = 512

    this._timeDomainArray = new Uint8Array( this._timeDomainAnalyser.frequencyBinCount )
    this._frequencyArray = new Uint8Array( this._frequencyAnalyser.frequencyBinCount )

    this._startAnalyse()
  }

  /**
   * 
   */
  stop() {
    if( this._reqId ) cancelAnimationFrame( this._reqId )
    this._clearCanvas()
  }

  /**
   * 
   */
  _startAnalyse = () => {
    this._reqId = requestAnimationFrame( this._startAnalyse )

    this._timeDomainAnalyser.getByteTimeDomainData( this._timeDomainArray )
    this._frequencyAnalyser.getByteFrequencyData( this._frequencyArray )

    this._clearCanvas()
   
    this._drawFrequency()
    this._drawTimeDomain()
  }

  /**
   * 
   */
  _clearCanvas() {
    const w = this._canvas.width
      , h = this._canvas.height

    this._canvasCtx.clearRect( 0, 0, w, h )
    this._canvasCtx.fillStyle = 'rgb(0, 0, 0)'
    this._canvasCtx.fillRect( 0, 0, w, h )
  }

  /**
   * 
   */
  _drawTimeDomain() {
    const w = this._canvas.width
      , h = this._canvas.height
    let x = 0

    let sliceWidth = w / this._timeDomainArray.length

    this._canvasCtx.beginPath()
    this._canvasCtx.strokeStyle = 'rgb( 0, 255, 0 )'
    this._canvasCtx.lineWidth = 1

    for( const data of this._timeDomainArray) {
      const y = h * ( data / 256 )

      if( x === 0 ) {
        this._canvasCtx.moveTo( x, y )
      } else {
        this._canvasCtx.lineTo( x, y )
      }

      x += sliceWidth
    }

    this._canvasCtx.lineTo( w, h / 2 )
    this._canvasCtx.stroke()
  }

  /**
   * 
   */
  _drawFrequency() {
    const w = this._canvas.width
      , h = this._canvas.height

    let x = 0
    const barWidth = w / this._frequencyArray.length * 2.5

    for( const data of this._frequencyArray ) {
      const barHeight = h * data / 256

      this._canvasCtx.fillStyle = `rgb(${ barHeight + 100 },50,50)`
      this._canvasCtx.fillRect( x, h - barHeight, barWidth, barHeight )

      x += barWidth + 1
    }
  }
} 