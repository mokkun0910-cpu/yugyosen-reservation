import { ImageResponse } from 'next/og'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a3a5c',
          borderRadius: '38px',
        }}
      >
        <div style={{ fontSize: 90, lineHeight: 1 }}>⚓</div>
        <div
          style={{
            fontSize: 22,
            color: '#c9a227',
            fontWeight: 'bold',
            marginTop: 4,
            letterSpacing: 2,
          }}
        >
          高喜丸
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
