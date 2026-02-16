import { describe, expect, it } from 'vitest';
import { reflectionMatrix } from '../../src/math/matrix';
import {
  deriveStepStatus,
  normalizeStep,
  stepToRuntimeInverse,
} from '../../src/math/transformEval';
import type { TransformStep } from '../../src/types/transforms';

function expectNear(actual: number, expected: number, eps = 1e-6) {
  expect(Math.abs(actual - expected)).toBeLessThan(eps);
}

describe('transformEval', () => {
  it('builds reflection matrix for y=x', () => {
    const matrix = reflectionMatrix(Math.PI / 4);
    expectNear(matrix[0], 0);
    expectNear(matrix[1], 1);
    expectNear(matrix[2], 1);
    expectNear(matrix[3], 0);
  });

  it('returns inverse for scale/shear/rotate linear transforms', () => {
    const scaleStep: TransformStep = normalizeStep({
      id: 's1',
      label: 'Scale 1',
      toolKind: 'scale',
      category: 'linear',
      payload: { a11: 2, a12: 0, a21: 0, a22: 2 },
      isComplete: false,
      isValid: false,
    });

    const shearStep: TransformStep = normalizeStep({
      id: 's2',
      label: 'Shear 1',
      toolKind: 'shear',
      category: 'linear',
      payload: { a11: 1, a12: 0.5, a21: 0, a22: 1 },
      isComplete: false,
      isValid: false,
    });

    const rotateStep: TransformStep = normalizeStep({
      id: 's3',
      label: 'Rotate 1',
      toolKind: 'rotate',
      category: 'linear',
      payload: {
        a11: Math.cos(Math.PI / 3),
        a12: -Math.sin(Math.PI / 3),
        a21: Math.sin(Math.PI / 3),
        a22: Math.cos(Math.PI / 3),
      },
      isComplete: false,
      isValid: false,
    });

    const scaleRuntime = stepToRuntimeInverse(scaleStep);
    const shearRuntime = stepToRuntimeInverse(shearStep);
    const rotateRuntime = stepToRuntimeInverse(rotateStep);

    expect(scaleRuntime.type).toBe(1);
    expectNear(scaleRuntime.data1[0], 0.5);
    expectNear(scaleRuntime.data1[3], 0.5);

    expect(shearRuntime.type).toBe(1);
    expectNear(shearRuntime.data1[0], 1);
    expectNear(shearRuntime.data1[1], -0.5);
    expectNear(shearRuntime.data1[2], 0);
    expectNear(shearRuntime.data1[3], 1);

    expect(rotateRuntime.type).toBe(1);
    expectNear(rotateRuntime.data1[0], Math.cos(Math.PI / 3));
    expectNear(rotateRuntime.data1[1], Math.sin(Math.PI / 3));
    expectNear(rotateRuntime.data1[2], -Math.sin(Math.PI / 3));
    expectNear(rotateRuntime.data1[3], Math.cos(Math.PI / 3));
  });

  it('derives affine inverse translation', () => {
    const step: TransformStep = normalizeStep({
      id: 'a1',
      label: 'Translate 1',
      toolKind: 'translate',
      category: 'affine',
      payload: {
        linear: { a11: 1, a12: 0, a21: 0, a22: 1 },
        tx: 0.4,
        ty: -0.7,
      },
      isComplete: false,
      isValid: false,
    });

    const runtime = stepToRuntimeInverse(step);
    expect(runtime.type).toBe(2);
    expectNear(runtime.data2[0], -0.4);
    expectNear(runtime.data2[1], -0.7);
  });

  it('requires nonzero Mobius determinant', () => {
    const invalidStep: TransformStep = {
      id: 'm1',
      label: 'Mobius 1',
      toolKind: 'define',
      category: 'mobius',
      payload: {
        a: { re: 1, im: 0 },
        b: { re: 2, im: 0 },
        c: { re: 2, im: 0 },
        d: { re: 4, im: 0 },
        anti: false,
      },
      isComplete: false,
      isValid: false,
    };

    const status = deriveStepStatus(invalidStep);
    expect(status.isComplete).toBe(true);
    expect(status.isValid).toBe(false);
  });

  it('treats incomplete transforms as invalid identity runtime', () => {
    const incomplete: TransformStep = {
      id: 'p1',
      label: 'Define (projective) 1',
      toolKind: 'define',
      category: 'projective',
      payload: { h: [1, 0, null, 0, 1, 0, 0, 0, 1] },
      isComplete: false,
      isValid: false,
    };

    const runtime = stepToRuntimeInverse(normalizeStep(incomplete));
    expect(runtime.type).toBe(0);
  });

  it('keeps circle inversion centered at origin during normalization', () => {
    const raw: TransformStep = {
      id: 'ci-1',
      label: 'Circle Inversion 1',
      toolKind: 'circleInversion',
      category: 'antiMobius',
      payload: {
        a: { re: 3, im: 5 },
        b: { re: 0.64, im: 2 },
        c: { re: 7, im: -3 },
        d: { re: 1, im: 9 },
        anti: false,
      },
      isComplete: false,
      isValid: false,
    };

    const normalized = normalizeStep(raw);
    const payload = normalized.payload as {
      a: { re: number; im: number };
      b: { re: number; im: number };
      c: { re: number; im: number };
      d: { re: number; im: number };
      anti: boolean;
    };

    expect(normalized.category).toBe('antiMobius');
    expect(payload.a).toEqual({ re: 0, im: 0 });
    expect(payload.c).toEqual({ re: 1, im: 0 });
    expect(payload.d).toEqual({ re: 0, im: 0 });
    expect(payload.b.im).toBe(0);
    expect(payload.b.re).toBeGreaterThan(0);
    expect(payload.anti).toBe(true);
  });
});
