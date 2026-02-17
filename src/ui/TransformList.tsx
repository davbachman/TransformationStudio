import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TransformStep } from '../types/transforms';

interface TransformListProps {
  steps: TransformStep[];
  selectedStepId: string | null;
  hasImage: boolean;
  showSourceImage: boolean;
  onSelect: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onDeleteSource: () => void;
  onToggleVisibility: (stepId: string) => void;
  onToggleSourceVisibility: () => void;
  onReorder: (dragId: string, targetId: string) => void;
}

function moveIds(ids: string[], dragId: string, targetId: string): string[] {
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) {
    return ids;
  }

  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function TransformList({
  steps,
  selectedStepId,
  hasImage,
  showSourceImage,
  onSelect,
  onDelete,
  onDeleteSource,
  onToggleVisibility,
  onToggleSourceVisibility,
  onReorder,
}: TransformListProps) {
  const [pendingDrag, setPendingDrag] = useState<{
    id: string;
    startIndex: number;
    startY: number;
    pitch: number;
  } | null>(null);
  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    startIndex: number;
    hoverIndex: number;
    startY: number;
    pitch: number;
  } | null>(null);
  const [itemHeights, setItemHeights] = useState<Record<string, number>>({});
  const [dropOrderIds, setDropOrderIds] = useState<string[] | null>(null);
  const [releaseNoTransition, setReleaseNoTransition] = useState(false);

  const suppressClickRef = useRef(false);
  const releaseFrameRef = useRef<number | null>(null);

  const stepIds = useMemo(() => steps.map((step) => step.id), [steps]);
  const stepById = useMemo(() => {
    const map: Record<string, TransformStep> = {};
    steps.forEach((step) => {
      map[step.id] = step;
    });
    return map;
  }, [steps]);

  const renderedStepIds = useMemo(() => dropOrderIds ?? stepIds, [dropOrderIds, stepIds]);
  const renderedSteps = useMemo(
    () => renderedStepIds.map((id) => stepById[id]).filter((step): step is TransformStep => Boolean(step)),
    [renderedStepIds, stepById],
  );

  const indexById = useMemo(() => {
    const map: Record<string, number> = {};
    steps.forEach((step, index) => {
      map[step.id] = index;
    });
    return map;
  }, [steps]);

  const dragIndex = activeDrag?.startIndex ?? -1;
  const hoverIndex = activeDrag?.hoverIndex ?? -1;
  const dragOffset = activeDrag?.pitch ?? 0;
  const gap = 8;

  const distanceBetweenIndices = useCallback(
    (start: number, end: number) => {
      if (start === end) {
        return 0;
      }

      let distance = 0;
      if (start < end) {
        for (let i = start + 1; i <= end; i += 1) {
          const id = stepIds[i];
          if (id) {
            distance += (itemHeights[id] ?? 58) + gap;
          }
        }
        return distance;
      }

      for (let i = start - 1; i >= end; i -= 1) {
        const id = stepIds[i];
        if (id) {
          distance += (itemHeights[id] ?? 58) + gap;
        }
      }
      return -distance;
    },
    [itemHeights, stepIds],
  );

  useEffect(() => {
    if (!dropOrderIds) {
      return;
    }

    const inSync =
      stepIds.length === dropOrderIds.length &&
      stepIds.every((stepId, index) => stepId === dropOrderIds[index]);

    if (!inSync) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDropOrderIds(null);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dropOrderIds, stepIds]);

  useEffect(() => {
    return () => {
      if (releaseFrameRef.current !== null) {
        window.cancelAnimationFrame(releaseFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingDrag && !activeDrag) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (activeDrag) {
        const delta = event.clientY - activeDrag.startY;
        let nextHover = activeDrag.startIndex;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let i = 0; i < steps.length; i += 1) {
          const slotDelta = distanceBetweenIndices(activeDrag.startIndex, i);
          const score = Math.abs(delta - slotDelta);
          if (score < bestDistance) {
            bestDistance = score;
            nextHover = i;
          }
        }

        setActiveDrag((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            hoverIndex: nextHover,
          };
        });
        return;
      }

      if (pendingDrag) {
        const delta = event.clientY - pendingDrag.startY;
        if (Math.abs(delta) < 4) {
          return;
        }

        suppressClickRef.current = true;
        let nextHover = pendingDrag.startIndex;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let i = 0; i < steps.length; i += 1) {
          const slotDelta = distanceBetweenIndices(pendingDrag.startIndex, i);
          const score = Math.abs(delta - slotDelta);
          if (score < bestDistance) {
            bestDistance = score;
            nextHover = i;
          }
        }

        setActiveDrag({
          ...pendingDrag,
          hoverIndex: nextHover,
        });
        setPendingDrag(null);
      }
    };

    const onPointerUp = () => {
      if (activeDrag) {
        setReleaseNoTransition(true);
        if (releaseFrameRef.current !== null) {
          window.cancelAnimationFrame(releaseFrameRef.current);
        }
        releaseFrameRef.current = window.requestAnimationFrame(() => {
          setReleaseNoTransition(false);
          releaseFrameRef.current = null;
        });

        const targetStep = steps[activeDrag.hoverIndex];
        if (targetStep && targetStep.id !== activeDrag.id) {
          setDropOrderIds(moveIds(stepIds, activeDrag.id, targetStep.id));
          onReorder(activeDrag.id, targetStep.id);
        }

        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      setPendingDrag(null);
      setActiveDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [activeDrag, distanceBetweenIndices, onReorder, pendingDrag, stepIds, steps]);

  return (
    <ul className="transform-list">
      {renderedSteps.map((step) => {
        const index = indexById[step.id] ?? -1;
        const selected = step.id === selectedStepId;
        const displayLabel = step.label.replace(/\s+\d+$/, '');
        let shiftY = 0;

        if (dragIndex >= 0 && hoverIndex >= 0) {
          if (activeDrag?.id === step.id) {
            shiftY = distanceBetweenIndices(dragIndex, hoverIndex);
          } else if (dragIndex < hoverIndex && index > dragIndex && index <= hoverIndex) {
            shiftY = -dragOffset;
          } else if (dragIndex > hoverIndex && index >= hoverIndex && index < dragIndex) {
            shiftY = dragOffset;
          }
        }

        return (
          <li
            key={step.id}
            className={`transform-item ${selected ? 'is-selected' : ''} ${activeDrag?.id === step.id ? 'is-dragging' : ''} ${
              activeDrag && activeDrag.id !== step.id && hoverIndex === index ? 'is-drop-target' : ''
            } ${releaseNoTransition ? 'no-transition' : ''}`}
            ref={(node) => {
              if (!node) {
                return;
              }
              const height = node.getBoundingClientRect().height;
              setItemHeights((prev) => {
                const previous = prev[step.id];
                if (previous !== undefined && Math.abs(previous - height) < 0.1) {
                  return prev;
                }
                return {
                  ...prev,
                  [step.id]: height,
                };
              });
            }}
            style={{ transform: shiftY === 0 ? undefined : `translateY(${shiftY}px)` }}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              if (dropOrderIds) {
                return;
              }
              if (
                (event.target as HTMLElement).closest('.transform-delete-btn') ||
                (event.target as HTMLElement).closest('.transform-visibility-btn')
              ) {
                return;
              }

              const height = itemHeights[step.id] ?? event.currentTarget.getBoundingClientRect().height;
              setPendingDrag({
                id: step.id,
                startIndex: index,
                startY: event.clientY,
                pitch: height + 8,
              });
            }}
            onClick={() => {
              if (suppressClickRef.current) {
                return;
              }
              onSelect(step.id);
            }}
          >
            <div className="transform-head">
              <div className="transform-title">{displayLabel}</div>
              <div className="transform-card-actions">
                <button
                  type="button"
                  className={`transform-visibility-btn ${step.isVisible ? 'is-visible' : 'is-hidden'}`}
                  aria-label={`${step.isVisible ? 'Hide' : 'Show'} ${step.label}`}
                  draggable={false}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleVisibility(step.id);
                  }}
                >
                  {step.isVisible ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M1.5 12s3.6-6 10.5-6 10.5 6 10.5 6-3.6 6-10.5 6S1.5 12 1.5 12z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M1.5 12s3.6-6 10.5-6c2.3 0 4.3.7 6 1.7" />
                      <path d="M22.5 12s-3.6 6-10.5 6c-2.3 0-4.3-.7-6-1.7" />
                      <circle cx="12" cy="12" r="3.5" />
                      <path d="M3 3l18 18" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className="transform-delete-btn"
                  aria-label={`Delete ${step.label}`}
                  draggable={false}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(step.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="transform-meta">
              <span className="pill">{step.category}</span>
              <span className={`pill ${step.isValid ? 'ok' : 'warn'}`}>
                {step.isComplete ? (step.isValid ? 'valid' : 'invalid') : 'incomplete'}
              </span>
            </div>
          </li>
        );
      })}

      <li className="transform-item source-item">
        <div className="transform-head">
          <div className="transform-title">Source Image</div>
          <div className="transform-card-actions">
            <button
              type="button"
              className={`transform-visibility-btn ${showSourceImage ? 'is-visible' : 'is-hidden'}`}
              aria-label={`${showSourceImage ? 'Hide' : 'Show'} Source Image`}
              disabled={!hasImage}
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSourceVisibility();
              }}
            >
              {showSourceImage ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M1.5 12s3.6-6 10.5-6 10.5 6 10.5 6-3.6 6-10.5 6S1.5 12 1.5 12z" />
                  <circle cx="12" cy="12" r="3.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M1.5 12s3.6-6 10.5-6c2.3 0 4.3.7 6 1.7" />
                  <path d="M22.5 12s-3.6 6-10.5 6c-2.3 0-4.3-.7-6-1.7" />
                  <circle cx="12" cy="12" r="3.5" />
                  <path d="M3 3l18 18" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="transform-delete-btn"
              aria-label="Delete Source Image"
              disabled={!hasImage}
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteSource();
              }}
            >
              ×
            </button>
          </div>
        </div>
      </li>
    </ul>
  );
}
