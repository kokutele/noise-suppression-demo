import React from 'react'
import { Select } from 'antd'

const { Option } = Select

export default function DeviceSelector( props ) {
  const { 
    items, 
    deviceId, 
    disabled, 
    style, 
    onChange 
  } = props

  return (
    <div className="DeviceSelector">
      <Select style={ style } value={ deviceId } onChange={ onChange } disabled={ disabled }>
        {items.map( ( item, idx ) => (
          <Option key={idx} value={item.deviceId}>{item.label}</Option>
        ))}
      </Select>
    </div>
  )
}