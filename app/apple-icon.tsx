import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
        }}
      >
        <div style={{ fontSize: 86, lineHeight: 1 }}>⚓</div>
        <div
          style={{
            fontSize: 20,
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
    { width: 180, height: 180 }
  )
}
