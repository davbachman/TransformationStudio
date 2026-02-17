import { describe, expect, it } from 'vitest';
import { liftStepToCategory, normalizeStep, stepToRuntimeInverse } from '../../src/math/transformEval';
import type { TransformStep } from '../../src/types/transforms';

describe('category lift behavior', () => {
  it('lifts linear to affine with zero translation', () => {
    const linearStep: TransformStep = normalizeStep({
      id: 'l1',
      label: 'Mirror 1',
      toolKind: 'mirror',
      category: 'linear',
      payload: { a11: 0, a12: 1, a21: 1, a22: 0 },
      isComplete: false,
      isValid: false,
      isVisible: true,
    });

    const lifted = liftStepToCategory(linearStep, 'affine');

    expect(lifted.category).toBe('affine');
    expect(lifted.toolKind).toBe('define');
    const payload = lifted.payload as { linear: { a11: number; a12: number; a21: number; a22: number }; tx: number; ty: number };
    expect(payload.linear.a12).toBe(1);
    expect(payload.tx).toBe(0);
    expect(payload.ty).toBe(0);
  });

  it('lifts linear to projective matrix', () => {
    const linearStep: TransformStep = normalizeStep({
      id: 'l2',
      label: 'Scale 1',
      toolKind: 'scale',
      category: 'linear',
      payload: { a11: 2, a12: 0, a21: 0, a22: 2 },
      isComplete: false,
      isValid: false,
      isVisible: true,
    });

    const lifted = liftStepToCategory(linearStep, 'projective');
    expect(lifted.category).toBe('projective');
    const payload = lifted.payload as { h: number[] };
    expect(payload.h).toEqual([2, 0, 0, 0, 2, 0, 0, 0, 1]);
  });

  it('lifts affine to projective matrix', () => {
    const affineStep: TransformStep = normalizeStep({
      id: 'a1',
      label: 'Translate 1',
      toolKind: 'translate',
      category: 'affine',
      payload: {
        linear: { a11: 1, a12: 0.4, a21: 0.2, a22: 1 },
        tx: 0.6,
        ty: -0.3,
      },
      isComplete: false,
      isValid: false,
      isVisible: true,
    });

    const lifted = liftStepToCategory(affineStep, 'projective');
    expect(lifted.category).toBe('projective');
    const payload = lifted.payload as { h: number[] };
    expect(payload.h).toEqual([1, 0.4, 0.6, 0.2, 1, 0.3, 0, 0, 1]);
  });

  it('preserves affine translation direction when lifted to projective', () => {
    const affineStep: TransformStep = normalizeStep({
      id: 'a2',
      label: 'Translate',
      toolKind: 'translate',
      category: 'affine',
      payload: {
        linear: { a11: 1, a12: 0, a21: 0, a22: 1 },
        tx: 1,
        ty: 1,
      },
      isComplete: false,
      isValid: false,
      isVisible: true,
    });

    const lifted = liftStepToCategory(affineStep, 'projective');
    const affineRuntime = stepToRuntimeInverse(affineStep);
    const projectiveRuntime = stepToRuntimeInverse(lifted);

    expect(affineRuntime.type).toBe(2);
    expect(projectiveRuntime.type).toBe(3);
    expect(affineRuntime.data2[1]).toBe(projectiveRuntime.data2[1]);
  });
});
