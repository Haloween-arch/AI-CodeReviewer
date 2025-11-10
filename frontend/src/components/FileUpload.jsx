import React, { useRef } from 'react'

export default function FileUpload({ onUpload, button }) {
  const inputRef = useRef()
  const onClick = () => inputRef.current?.click()
  const onChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    onUpload(text, file.name)
    e.target.value = ''
  }

  return (
    <>
      <span onClick={onClick} style={{ cursor: 'pointer' }}>{button}</span>
      <input ref={inputRef} type="file" hidden onChange={onChange} />
    </>
  )
}
