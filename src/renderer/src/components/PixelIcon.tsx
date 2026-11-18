import { memo, type ReactNode } from 'react'
import { ICON_SIZE, ICONS, iconRuns } from '../../../shared/icons'
import type { IconId } from '../../../shared/types'

/** Renders a pixel-art icon as inline SVG with crisp, pixelated edges. */
export const PixelIcon = memo(function PixelIcon({
  id,
  size = 64,
  className = ''
}: {
  id: IconId
  size?: number
  className?: string
}): ReactNode {
  const label = ICONS[id]?.label ?? 'Product'
  return (
    <svg
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={`pixelated shrink-0 ${className}`}
      style={{ imageRendering: 'pixelated' }}
    >
      {iconRuns(id).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.color} />
      ))}
    </svg>
  )
})
