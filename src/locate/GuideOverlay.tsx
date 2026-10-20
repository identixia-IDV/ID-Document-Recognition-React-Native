import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { passportGuideRect, type Point } from '../resultParser';

const DIM = '#CCE6E9EF';
const MUTED = '#5A6573';
const ACCENT = '#0F766E';
const HOLE_RADIUS = 16;

function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${x + rr},${y} H${x + w - rr} A${rr},${rr} 0 0 1 ${x + w},${y + rr}` +
    ` V${y + h - rr} A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}` +
    ` H${x + rr} A${rr},${rr} 0 0 1 ${x},${y + h - rr}` +
    ` V${y + rr} A${rr},${rr} 0 0 1 ${x + rr},${y} Z`
  );
}

/** Passport hole or locate quad — same geometry as Ionic/Flutter. */
export function guideHolePath(
  corners: Point[] | null,
  width: number,
  height: number
): string {
  if (corners && corners.length >= 4) {
    const a = corners[0]!;
    const b = corners[1]!;
    const c = corners[2]!;
    const d = corners[3]!;
    return `M${a.x},${a.y} L${b.x},${b.y} L${c.x},${c.y} L${d.x},${d.y} Z`;
  }
  const guide = passportGuideRect(width, height);
  return roundedRectPath(
    guide.left,
    guide.top,
    guide.width,
    guide.height,
    HOLE_RADIUS
  );
}

export type GuideOverlayProps = {
  corners: Point[] | null;
  locked: boolean;
  width: number;
  height: number;
};

/**
 * Dimmed preview + passport rectangle (or live locate quad).
 * Uses evenodd punch (Ionic/Cordova style) — Android SVG Mask is unreliable.
 */
export function GuideOverlay({
  corners,
  locked,
  width,
  height,
}: GuideOverlayProps) {
  if (width <= 1 || height <= 1) return null;
  const hole = guideHolePath(corners, width, height);
  const dim = `M0,0 H${width} V${height} H0 Z ${hole}`;
  const stroke = locked ? ACCENT : MUTED;
  const strokeWidth = locked ? 8 : 5;
  const holeKey = corners
    ? corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
    : `guide:${width}x${height}`;

  return (
    <View pointerEvents="none" collapsable={false} style={styles.layer}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={StyleSheet.absoluteFill}
      >
        <Path
          key={`dim:${holeKey}`}
          d={dim}
          fill={DIM}
          fillRule="evenodd"
        />
        <Path
          key={`stroke:${holeKey}`}
          d={hole}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    elevation: 2,
  },
});
