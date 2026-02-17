import { useEffect, useMemo, useRef, useState } from 'react';
import { toRuntimeSteps } from '../math/transformEval';
import { Renderer } from '../render/webgl/Renderer';
import type { EditorImage, TransformPayload, TransformStep } from '../types/transforms';
import { ManipulatorOverlay } from './ManipulatorOverlay';

interface CanvasViewportProps {
  image: EditorImage | null;
  steps: TransformStep[];
  selectedStep: TransformStep | null;
  showFirstImage: boolean;
  showSquareGrid: boolean;
  showPolarGrid: boolean;
  onUpdatePayload: (stepId: string, payload: TransformPayload) => void;
}

export interface WorldBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const WORLD_SCALE = 2;

function computeWorldBounds(width: number, height: number): WorldBounds {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspect = safeWidth / safeHeight;

  if (aspect >= 1) {
    return {
      xMin: -WORLD_SCALE * aspect,
      xMax: WORLD_SCALE * aspect,
      yMin: -WORLD_SCALE,
      yMax: WORLD_SCALE,
    };
  }

  const invAspect = 1 / aspect;
  return {
    xMin: -WORLD_SCALE,
    xMax: WORLD_SCALE,
    yMin: -WORLD_SCALE * invAspect,
    yMax: WORLD_SCALE * invAspect,
  };
}

export function CanvasViewport({
  image,
  steps,
  selectedStep,
  showFirstImage,
  showSquareGrid,
  showPolarGrid,
  onUpdatePayload,
}: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [resizeTick, setResizeTick] = useState(0);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [worldBounds, setWorldBounds] = useState<WorldBounds>(() => computeWorldBounds(1, 1));

  const chronologicalSteps = useMemo(() => [...steps].reverse(), [steps]);
  const runtimeSteps = useMemo(() => toRuntimeSteps(chronologicalSteps), [chronologicalSteps]);
  const visibleSteps = useMemo(
    () => chronologicalSteps.map((step) => step.isVisible),
    [chronologicalSteps],
  );

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    try {
      rendererRef.current = new Renderer(canvasRef.current);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to initialize renderer.';
      rendererRef.current = null;
      window.setTimeout(() => {
        setRendererError(message);
      }, 0);
    }

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const updateBounds = (width: number, height: number) => {
      setResizeTick((value) => value + 1);
      setWorldBounds(computeWorldBounds(width, height));
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateBounds(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(containerRef.current);
    updateBounds(containerRef.current.clientWidth, containerRef.current.clientHeight);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      renderer.render({
        image,
        steps: runtimeSteps,
        showFirstImage,
        visibleSteps,
        showSquareGrid,
        showPolarGrid,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [image, resizeTick, runtimeSteps, showFirstImage, showPolarGrid, showSquareGrid, visibleSteps]);

  return (
    <section ref={containerRef} className="canvas-viewport">
      <canvas ref={canvasRef} className="render-canvas" />

      <ManipulatorOverlay
        step={selectedStep}
        worldBounds={worldBounds}
        onUpdatePayload={onUpdatePayload}
      />

      {rendererError && (
        <div className="canvas-placeholder">
          <p>{rendererError}</p>
        </div>
      )}

      {!rendererError && !image && (
        <div className="canvas-placeholder">
          <p>Upload an image to start experimenting with transformations.</p>
        </div>
      )}
    </section>
  );
}
