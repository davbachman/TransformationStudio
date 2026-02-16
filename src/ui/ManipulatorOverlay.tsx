import { useRef } from 'react';
import {
  reflectionMatrix,
  rotationMatrix,
  scaleMatrix,
} from '../math/matrix';
import {
  isAffineStep,
  isLinearStep,
  isMobiusStep,
  linearValuesOrIdentity,
  mat2ToLinearData,
} from '../math/transformEval';
import type { TransformPayload, TransformStep } from '../types/transforms';
import type { WorldBounds } from './CanvasViewport';

interface ManipulatorOverlayProps {
  step: TransformStep | null;
  worldBounds: WorldBounds;
  onUpdatePayload: (stepId: string, payload: TransformPayload) => void;
}

type DragMode =
  | 'mirror'
  | 'scale'
  | 'generalFirst'
  | 'generalSecond'
  | 'shear'
  | 'shearFixed'
  | 'rotate'
  | 'translate'
  | 'circleInversion'
  | null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pointerToWorld(
  event: React.PointerEvent<SVGSVGElement>,
  svg: SVGSVGElement,
  bounds: WorldBounds,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const nx = (event.clientX - rect.left) / rect.width;
  const ny = (event.clientY - rect.top) / rect.height;
  return {
    x: bounds.xMin + nx * (bounds.xMax - bounds.xMin),
    y: bounds.yMin + (1 - ny) * (bounds.yMax - bounds.yMin),
  };
}

function wedgePath(radius: number, theta: number): string {
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  const largeArc = Math.abs(theta) > Math.PI ? 1 : 0;
  const sweep = theta >= 0 ? 1 : 0;
  return `M 0 0 L ${radius} 0 A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x} ${y} Z`;
}

function arcPath(radius: number, theta: number): string {
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  const largeArc = Math.abs(theta) > Math.PI ? 1 : 0;
  const sweep = theta >= 0 ? 1 : 0;
  return `M ${radius} 0 A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x} ${y}`;
}

function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < 1e-8) {
    return { x: 1, y: 0 };
  }
  return { x: x / len, y: y / len };
}

function normalizeLineAngle(angle: number): number {
  let value = angle;
  while (value < -Math.PI / 2) {
    value += Math.PI;
  }
  while (value >= Math.PI / 2) {
    value -= Math.PI;
  }
  return value;
}

function composeShearMatrix(k: number, phi: number): [number, number, number, number] {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return [
    1 - k * c * s,
    k * c * c,
    -k * s * s,
    1 + k * s * c,
  ];
}

function deriveShearParams(linear: [number, number, number, number]): { k: number; phi: number } {
  const [a, b, cValue, d] = linear;
  const v1 = { x: b, y: 1 - a };
  const v2 = { x: d - 1, y: -cValue };

  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  const basis = n1 >= n2 ? v1 : v2;
  const phi = n1 < 1e-8 && n2 < 1e-8 ? 0 : normalizeLineAngle(Math.atan2(basis.y, basis.x));

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  let k = 0;
  const cos2 = cosPhi * cosPhi;
  const sin2 = sinPhi * sinPhi;
  const mixed = 2 * cosPhi * sinPhi;

  if (cos2 > 1e-5) {
    k = b / cos2;
  } else if (sin2 > 1e-5) {
    k = -cValue / sin2;
  } else if (Math.abs(mixed) > 1e-5) {
    k = (d - a) / mixed;
  }

  return { k: clamp(k, -3, 3), phi };
}

function arrowHeadPoints(
  tipX: number,
  tipY: number,
  size = 0.06,
  halfWidth = 0.03,
): string {
  const dir = normalize(tipX, tipY);
  const baseX = tipX - dir.x * size;
  const baseY = tipY - dir.y * size;
  const perpX = -dir.y;
  const perpY = dir.x;

  const leftX = baseX + perpX * halfWidth;
  const leftY = baseY + perpY * halfWidth;
  const rightX = baseX - perpX * halfWidth;
  const rightY = baseY - perpY * halfWidth;

  return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
}

export function ManipulatorOverlay({ step, worldBounds, onUpdatePayload }: ManipulatorOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragModeRef = useRef<DragMode>(null);

  if (!step || step.toolKind === 'define') {
    return null;
  }

  const commitPayload = (payload: TransformPayload) => {
    onUpdatePayload(step.id, payload);
  };

  const xExtent = Math.max(Math.abs(worldBounds.xMin), Math.abs(worldBounds.xMax));
  const yExtent = Math.max(Math.abs(worldBounds.yMin), Math.abs(worldBounds.yMax));
  const axisExtent = Math.max(xExtent, yExtent);
  const txMin = Math.min(worldBounds.xMin, worldBounds.xMax);
  const txMax = Math.max(worldBounds.xMin, worldBounds.xMax);
  const tyMin = Math.min(worldBounds.yMin, worldBounds.yMax);
  const tyMax = Math.max(worldBounds.yMin, worldBounds.yMax);

  const startDrag = (mode: DragMode, event: React.PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    dragModeRef.current = mode;
    svg.setPointerCapture(event.pointerId);
  };

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    dragModeRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragModeRef.current) {
      return;
    }

    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const point = pointerToWorld(event, svg, worldBounds);

    if (dragModeRef.current === 'mirror' && isLinearStep(step)) {
      const angle = -Math.atan2(point.y, point.x);
      commitPayload(mat2ToLinearData(reflectionMatrix(angle)));
      return;
    }

    if (dragModeRef.current === 'scale' && isLinearStep(step)) {
      const base = 0.35;
      const dist = Math.hypot(point.x, point.y);
      const scale = clamp(dist / base, 0.1, 10);
      commitPayload(mat2ToLinearData(scaleMatrix(scale)));
      return;
    }

    if (dragModeRef.current === 'generalFirst' && isLinearStep(step)) {
      const current = linearValuesOrIdentity(step.payload);
      const x = clamp(point.x, txMin, txMax);
      const y = clamp(point.y, tyMin, tyMax);
      // Convert displayed basis (y-up) into stored matrix convention (off-diagonals sign-flipped).
      commitPayload(mat2ToLinearData([x, current[1], -y, current[3]]));
      return;
    }

    if (dragModeRef.current === 'generalSecond' && isLinearStep(step)) {
      const current = linearValuesOrIdentity(step.payload);
      const x = clamp(point.x, txMin, txMax);
      const y = clamp(point.y, tyMin, tyMax);
      // Convert displayed basis (y-up) into stored matrix convention (off-diagonals sign-flipped).
      commitPayload(mat2ToLinearData([current[0], -x, current[2], y]));
      return;
    }

    if (dragModeRef.current === 'shear' && isLinearStep(step)) {
      const current = deriveShearParams(linearValuesOrIdentity(step.payload));
      const cosPhi = Math.cos(current.phi);
      const sinPhi = Math.sin(current.phi);
      const localX = cosPhi * point.x + sinPhi * point.y;
      const localY = -sinPhi * point.x + cosPhi * point.y;
      const safeY = Math.abs(localY) < 0.06 ? 0.06 * (localY >= 0 ? 1 : -1) : localY;
      const k = clamp(-localX / safeY, -3, 3);
      commitPayload(mat2ToLinearData(composeShearMatrix(k, current.phi)));
      return;
    }

    if (dragModeRef.current === 'shearFixed' && isLinearStep(step)) {
      const current = deriveShearParams(linearValuesOrIdentity(step.payload));
      const phi = normalizeLineAngle(Math.atan2(point.y, point.x));
      commitPayload(mat2ToLinearData(composeShearMatrix(current.k, phi)));
      return;
    }

    if (dragModeRef.current === 'rotate' && isLinearStep(step)) {
      const theta = Math.atan2(point.y, point.x);
      commitPayload(mat2ToLinearData(rotationMatrix(-theta)));
      return;
    }

    if (dragModeRef.current === 'translate' && isAffineStep(step)) {
      commitPayload({
        ...step.payload,
        tx: clamp(point.x, txMin, txMax),
        ty: clamp(point.y, tyMin, tyMax),
      });
      return;
    }

    if (dragModeRef.current === 'circleInversion' && isMobiusStep(step)) {
      const radius = clamp(Math.hypot(point.x, point.y), 0.05, axisExtent * 1.3);
      const radiusSq = radius * radius;
      commitPayload({
        a: { re: 0, im: 0 },
        b: { re: radiusSq, im: 0 },
        c: { re: 1, im: 0 },
        d: { re: 0, im: 0 },
        anti: true,
      });
    }
  };

  const linear = isLinearStep(step) ? linearValuesOrIdentity(step.payload) : null;

  const mirrorAngle = linear ? -Math.atan2(linear[1], linear[0]) * 0.5 : Math.PI / 4;
  const scaleFactor = linear ? clamp((linear[0] + linear[3]) * 0.5, 0.1, 10) : 1;
  const generalFirst = linear ? { x: linear[0], y: -linear[2] } : { x: 1, y: 0 };
  const generalSecond = linear ? { x: -linear[1], y: linear[3] } : { x: 0, y: 1 };
  const shearParams = linear ? deriveShearParams(linear) : { k: 0.35, phi: 0 };
  const shearValue = -shearParams.k;
  const shearFixedAngle = shearParams.phi;
  const rotationAngle = linear ? -Math.atan2(linear[2], linear[0]) : 0;

  const translate = isAffineStep(step)
    ? {
      x: step.payload.tx ?? 0,
      y: step.payload.ty ?? 0,
    }
    : { x: 0, y: 0 };

  const inversionRadius = isMobiusStep(step)
    ? Math.sqrt(Math.max(Math.abs(step.payload.b?.re ?? 1), 0.01))
    : 1;

  const mirrorExtent = axisExtent * 1.35;
  const mirrorLineEnd = {
    x: mirrorExtent * Math.cos(mirrorAngle),
    y: mirrorExtent * Math.sin(mirrorAngle),
  };

  const scaleRadius = clamp(0.35 * scaleFactor, 0.06, 0.95);

  const shearExtent = axisExtent * 1.3;
  const fixedDirection = {
    x: Math.cos(shearFixedAngle),
    y: Math.sin(shearFixedAngle),
  };
  const localSheared = normalize(shearValue, 1);
  const shearAxis = {
    x: fixedDirection.x * localSheared.x - fixedDirection.y * localSheared.y,
    y: fixedDirection.y * localSheared.x + fixedDirection.x * localSheared.y,
  };
  const fixedEnd = {
    x: fixedDirection.x * shearExtent,
    y: fixedDirection.y * shearExtent,
  };
  const shearEnd = {
    x: shearAxis.x * shearExtent,
    y: shearAxis.y * shearExtent,
  };

  const rotateRadius = 0.65;
  const rotateRay = {
    x: rotateRadius * Math.cos(rotationAngle),
    y: rotateRadius * Math.sin(rotationAngle),
  };

  return (
    <svg
      ref={svgRef}
      className="manipulator-overlay"
      viewBox={`${worldBounds.xMin} ${worldBounds.yMin} ${worldBounds.xMax - worldBounds.xMin} ${worldBounds.yMax - worldBounds.yMin}`}
      preserveAspectRatio="none"
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <g transform="scale(1,-1)">
        <line x1={worldBounds.xMin} y1={0} x2={worldBounds.xMax} y2={0} className="overlay-axis" />
        <line x1={0} y1={worldBounds.yMin} x2={0} y2={worldBounds.yMax} className="overlay-axis" />

        {step.toolKind === 'mirror' && (
          <line
            x1={-mirrorLineEnd.x}
            y1={-mirrorLineEnd.y}
            x2={mirrorLineEnd.x}
            y2={mirrorLineEnd.y}
            className="overlay-red-line overlay-red-line-strong"
            onPointerDown={(event) => startDrag('mirror', event)}
          />
        )}

        {step.toolKind === 'scale' && (
          <>
            {Array.from({ length: 8 }, (_, i) => {
              const theta = (i / 8) * Math.PI * 2;
              const x = scaleRadius * Math.cos(theta);
              const y = scaleRadius * Math.sin(theta);
              return (
                <g key={`scale-arrow-${theta}`} onPointerDown={(event) => startDrag('scale', event)}>
                  <line x1={0} y1={0} x2={x} y2={y} className="overlay-red-line" />
                  <polygon points={arrowHeadPoints(x, y, 0.05, 0.024)} className="overlay-red-fill" />
                </g>
              );
            })}
          </>
        )}

        {step.toolKind === 'general' && (
          <>
            <line
              x1={0}
              y1={0}
              x2={generalFirst.x}
              y2={generalFirst.y}
              className="overlay-yellow-line"
              onPointerDown={(event) => startDrag('generalFirst', event)}
            />
            <polygon
              points={arrowHeadPoints(generalFirst.x, generalFirst.y, 0.09, 0.045)}
              className="overlay-yellow-fill"
              onPointerDown={(event) => startDrag('generalFirst', event)}
            />
            <line
              x1={0}
              y1={0}
              x2={generalSecond.x}
              y2={generalSecond.y}
              className="overlay-red-line overlay-red-line-strong"
              onPointerDown={(event) => startDrag('generalSecond', event)}
            />
            <polygon
              points={arrowHeadPoints(generalSecond.x, generalSecond.y, 0.09, 0.045)}
              className="overlay-red-fill"
              onPointerDown={(event) => startDrag('generalSecond', event)}
            />
          </>
        )}

        {step.toolKind === 'shear' && (
          <>
            <line
              x1={-fixedEnd.x}
              y1={-fixedEnd.y}
              x2={fixedEnd.x}
              y2={fixedEnd.y}
              className="overlay-yellow-line"
              onPointerDown={(event) => startDrag('shearFixed', event)}
            />
            <line
              x1={-shearEnd.x}
              y1={-shearEnd.y}
              x2={shearEnd.x}
              y2={shearEnd.y}
              className="overlay-red-line"
              onPointerDown={(event) => startDrag('shear', event)}
            />
          </>
        )}

        {step.toolKind === 'rotate' && (
          <>
            <line x1={0} y1={0} x2={rotateRadius} y2={0} className="overlay-axis-ref" />
            <line
              x1={0}
              y1={0}
              x2={rotateRay.x}
              y2={rotateRay.y}
              className="overlay-red-line"
              onPointerDown={(event) => startDrag('rotate', event)}
            />
            <path d={wedgePath(rotateRadius, rotationAngle)} className="overlay-sector" />
            <path
              d={arcPath(rotateRadius, rotationAngle)}
              className="overlay-red-line overlay-arc-handle"
              onPointerDown={(event) => startDrag('rotate', event)}
            />
          </>
        )}

        {step.toolKind === 'translate' && (
          <>
            <line
              x1={0}
              y1={0}
              x2={translate.x}
              y2={translate.y}
              className="overlay-red-line overlay-red-line-strong"
              onPointerDown={(event) => startDrag('translate', event)}
            />
            <polygon
              points={arrowHeadPoints(translate.x, translate.y, 0.09, 0.05)}
              className="overlay-red-fill"
              onPointerDown={(event) => startDrag('translate', event)}
            />
          </>
        )}

        {step.toolKind === 'circleInversion' && (
          <>
            <circle
              cx={0}
              cy={0}
              r={inversionRadius}
              className="overlay-red-line"
              onPointerDown={(event) => startDrag('circleInversion', event)}
            />
          </>
        )}
      </g>
    </svg>
  );
}
