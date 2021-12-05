import React, { 
  useCallback,
  useEffect,
  useMemo,
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
import DeviceSelector from '../components/device-selector'

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
  const [ _deviceId, setDeviceId ] = useState( '' )
  const [ _deviceName, setDeviceName ] = useState( '' )
  const [ _deviceList, setDeviceList ] = useState( [] )

  const isNoseSuppressionSupported = useMemo( () => {
    const supportedConstraints = navigator.mediaDevices.getSupportedConstraints()

    return !!supportedConstraints.noiseSuppression
  }, [])

  const isEchoCancellationSupported = useMemo( () => {
    const supportedConstraints = navigator.mediaDevices.getSupportedConstraints()

    return !!supportedConstraints.echoCancellation
  }, [])

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
   * マイクソースリストを取得する side effect
   * 
   */
  useEffect( () => {
    if ( _status !== STATUS.CONNECTED ) return
    ( async () => {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDeviceList( list.filter( item => item.kind === 'audioinput' ))
    })()
  }, [ _status ])

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

    _connector.current = RemoteConnector.create()

    _connector.current.on("log", obj => {
      setLogs( prev => [ ...prev, obj ])
    })

    _connector.current.on('track', track => {
      if( !_stream.current ) {
        _stream.current = new MediaStream()
        _audioEle.current.srcObject = _stream.current

        _audioEle.current.addEventListener('loadedmetadata', async () => {
          await _audioEle.current.play()

          _analyzer.current = new AudioAnalyser()
          _analyzer.current.start( _stream.current, _canvasEle.current )

          // hack for safari
          _connector.current.changeSettings( {} )
          setStatus(STATUS.CONNECTED)
        })
      }

      _stream.current.addTrack( track )
    })

    _connector.current.on('update:settings', settings => {
      if( settings.echoCancellation !== undefined ) {
        setEchoCancellation( settings.echoCancellation )
      }
      if( settings.noiseSuppression !== undefined ) {
        setNoiseSuppression( settings.noiseSuppression )
      }
      if( settings.deviceId !== undefined ) {
        setDeviceId( settings.deviceId )
      }
    })

    _connector.current.on('deviceName', name => {
      setDeviceName( name )
    })
    await _connector.current.start()
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
      <div className="controller">
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
        </div>
        <div>
          <Button 
            type="default" 
            onClick={ () => {
              handleStop()
            }} 
            disabled={ _status === STATUS.IDLE }  
            danger
          >stop</Button>
        </div>
        { ( _status === STATUS.CONNECTED && !!_deviceName ) && (
        <div>
          device: <strong>{_deviceName}</strong>
        </div>
        )}
      </div>
      <div>
        <audio ref={ _audioEle } />
        <div className="analyzer">
          <canvas ref={ _canvasEle } ></canvas>
        </div>
        <div className="panel">
          <div className="panel-item">
            <DeviceSelector 
              deviceId={ _deviceId }
              items={ _deviceList } 
              disabled={ _status !== STATUS.CONNECTED }
              onChange={ deviceId => changeSettings( { deviceId } ) }
              style={{ width: 240 }}
            />
          </div>
          <div className="panel-item">
            { isEchoCancellationSupported && (
            <div>
              echoCancellation&nbsp;
              <Switch 
                onChange={ checked => changeSettings({ echoCancellation: checked }) }
                checked={ _echoCancellation } 
                disabled={ _status !== STATUS.CONNECTED } 
              />
            </div>
            )}
            { isNoseSuppressionSupported && (
            <div>
              noiseSuppression&nbsp;
              <Switch 
                onChange={ checked => changeSettings({ noiseSuppression: checked }) }
                checked={ _noiseSuppression } 
                disabled={ _status !== STATUS.CONNECTED } 
              />
            </div>
            )}
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