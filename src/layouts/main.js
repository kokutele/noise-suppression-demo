import React, { 
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import { 
  Button,
  Divider,
  Switch
} from 'antd'

import RemoteConnector from '../libs/remote-connector'
import AudioAnalyser from '../libs/audio-analyser'

import './main.css'

const STATUS = {
  IDLE: "IDLE",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR"
}

export default function Main( props ) {
  const _audioEle = useRef( null )
  const _canvasEle = useRef( null )
  const _connector = useRef( null )
  const _analyzer = useRef( null )
  const _stream = useRef( null )

  const [ _status, setStatus ] = useState( STATUS.IDLE )
  const [ _echoCancellation, setEchoCancellation ] = useState( true )
  const [ _noiseSuppression, setNoiseSuppression ] = useState( true )
  const [ _logs, setLogs ] = useState( [] )

  /**
   * canvas size を自動調節する side effect
   * 
   */
  useEffect( () => {
    const fitSize = () => {
      _canvasEle.current.width = _canvasEle.current.clientWidth
      _canvasEle.current.height = _canvasEle.current.clientHeight
    }

    window.onresize = fitSize
    fitSize()
  }, [])

  /**
   * start ボタンをクリックしたときのコールバック
   * 1. WebRTC 接続
   * 2. 再生開始
   * 3. 音声解析開始
   * 処理を行う
   * 
   */
  const handleStart = useCallback( async () => {
    if( _status !== STATUS.IDLE ) return

    setStatus( STATUS.CONNECTING )

    const connector = RemoteConnector.create()

    connector.on("log", obj => {
      setLogs( prev => [ ...prev, obj ])
    })

    connector.on('track', track => {
      if( !_stream.current ) {
        _stream.current = new MediaStream()
        _audioEle.current.srcObject = _stream.current

        _audioEle.current.addEventListener('loadedmetadata', () => {
          _audioEle.current.play()

          _analyzer.current = new AudioAnalyser()
          _analyzer.current.start( _stream.current, _canvasEle.current )

          // hack for safari
          connector.changeSettings( {} )
          setStatus(STATUS.CONNECTED)
        })
      }

      _stream.current.addTrack( track )
    })

    connector.on('update:settings', settings => {
      if( settings.echoCancellation !== undefined ) {
        setEchoCancellation( settings.echoCancellation )
      }
      if( settings.noiseSuppression !== undefined ) {
        setNoiseSuppression( settings.noiseSuppression )
      }
    })
    await connector.start()

    _connector.current = connector
  }, [ _status ])

  /**
   * `stop` がクリックされたときのコールバック
   *  WebRTC 接続や解析オブジェクトの解放処理などを
   * 行っている
   * 
   */
  const handleStop = useCallback( () => {
    _connector.current.stop()
    _connector.current = null

    _stream.current = null

    _audioEle.current.pause()
    _audioEle.current.srcObject = null

    if( _analyzer.current ) {
      _analyzer.current.stop()
      _analyzer.current = null
    }

    setLogs( [] )
    setStatus( STATUS.IDLE )
  }, [])

  /**
   * echoCancellation, noiseSuppression の
   * 設定値確認を行うコールバック
   * 
   */
  const checkAudioSettings = useCallback( () => {
    if( _status !== STATUS.CONNECTED ) return
    _connector.current.checkAudioSettings()
  }, [ _status ])

  /**
   * echoCancellation, noiseSuppression の
   * 設定変更を行うコールバック
   * 
   * @param {object} settings
   * @param {boolean} [settings.echoCancellation]
   * @param {boolean} [settings.noiseSuppression]
   * 
   */
  const changeSettings = useCallback( async settings => {
    if( _status === STATUS.CONNECTED ) {
      await _connector.current.changeSettings( settings )
    }
  }, [ _status ])


  return (
    <div className="Main">
      <div>
        <Button 
          type="primary" 
          onClick={ async () => {
            await handleStart()
            checkAudioSettings()
          }} 
          disabled={ _status !== STATUS.IDLE }  
          danger
        >start</Button>
        <Button 
          type="default" 
          onClick={ () => {
            handleStop()
          }} 
          disabled={ _status === STATUS.IDLE }  
          danger
        >stop</Button>
      </div>
      <div>
        <audio ref={ _audioEle } />
        <div className="analyzer">
          <canvas ref={ _canvasEle } ></canvas>
        </div>
        <div className="panel">
          <div>
            echoCancellation&nbsp;
            <Switch 
              onChange={ checked => changeSettings({ echoCancellation: checked }) }
              checked={ _echoCancellation } 
              disabled={ _status !== STATUS.CONNECTED } 
            />
          </div>
          <div>
            noiseSuppression&nbsp;
            <Switch 
              onChange={ checked => changeSettings({ noiseSuppression: checked }) }
              checked={ _noiseSuppression } 
              disabled={ _status !== STATUS.CONNECTED } 
            />
          </div>
        </div>
      </div>
      <Divider />
      <div className="logs">
        { _logs.length > 0 && (
          <h2>WebRTC log</h2>
        )}
        { _logs.map( ({ timestamp, label, message }, idx) => (
          <div key={idx} className={`${label} line`}>[{timestamp}] - {label} : {message}</div>
        ))}
      </div>
    </div>
  )
}