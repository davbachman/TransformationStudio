import {
  abs2Complex,
  cloneComplex,
  complex,
  mulComplex,
  negComplex,
  subComplex,
} from './complex';
import {
  det2,
  det3,
  invert2,
  invert3,
  reflectionMatrix,
  rotationMatrix,
  scaleMatrix,
  shearMatrix,
  type Mat2,
  type Mat3,
} from './matrix';
import {
  type AffineData,
  type Category,
  type LinearData,
  MAX_STEPS,
  type MobiusData,
  type ProjectiveData,
  type RuntimeStep,
  type ToolKind,
  type TransformPayload,
  type TransformStep,
} from '../types/transforms';

const EPSILON = 1e-8;

export const IDENTITY_RUNTIME_STEP: RuntimeStep = {
  type: 0,
  data1: [0, 0, 0, 0],
  data2: [0, 0, 0, 0],
  data3: [0, 0, 0, 0],
};

export const CATEGORY_TOOLS: Record<Category, ToolKind[]> = {
  linear: ['mirror', 'scale', 'shear', 'rotate', 'general', 'define'],
  affine: ['translate', 'define'],
  projective: ['define'],
  mobius: ['define'],
  antiMobius: ['circleInversion', 'define'],
};

export function toMat2(data: LinearData): Mat2 {
  return [
    data.a11 ?? 0,
    data.a12 ?? 0,
    data.a21 ?? 0,
    data.a22 ?? 0,
  ];
}

export function toMat3(data: ProjectiveData): Mat3 {
  const h = data.h;
  return [
    h[0] ?? 0,
    h[1] ?? 0,
    h[2] ?? 0,
    h[3] ?? 0,
    h[4] ?? 0,
    h[5] ?? 0,
    h[6] ?? 0,
    h[7] ?? 0,
    h[8] ?? 0,
  ];
}

export function mat2ToLinearData(m: Mat2): LinearData {
  return { a11: m[0], a12: m[1], a21: m[2], a22: m[3] };
}

export function createInitialPayload(toolKind: ToolKind, category: Category): TransformPayload {
  if (toolKind === 'mirror') {
    return mat2ToLinearData(reflectionMatrix(-Math.PI / 4));
  }

  if (toolKind === 'scale') {
    return mat2ToLinearData(scaleMatrix(1));
  }

  if (toolKind === 'shear') {
    return mat2ToLinearData(shearMatrix(0.35));
  }

  if (toolKind === 'rotate') {
    return mat2ToLinearData(rotationMatrix(Math.PI / 8));
  }

  if (toolKind === 'general') {
    return mat2ToLinearData([1, 0, 0, 1]);
  }

  if (toolKind === 'translate') {
    return {
      linear: mat2ToLinearData([1, 0, 0, 1]),
      tx: 1,
      ty: 0,
    };
  }

  if (toolKind === 'circleInversion') {
    const radius = 1;
    return {
      a: complex(0, 0),
      b: complex(radius * radius, 0),
      c: complex(1, 0),
      d: complex(0, 0),
      anti: true,
    };
  }

  switch (category) {
    case 'linear':
      return { a11: null, a12: null, a21: null, a22: null };
    case 'affine':
      return {
        linear: { a11: null, a12: null, a21: null, a22: null },
        tx: null,
        ty: null,
      };
    case 'projective':
      return { h: Array.from({ length: 9 }, () => null) };
    case 'mobius':
      return { a: null, b: null, c: null, d: null, anti: false };
    case 'antiMobius':
      return { a: null, b: null, c: null, d: null, anti: true };
    default:
      return { a11: null, a12: null, a21: null, a22: null };
  }
}

export function toolLabel(toolKind: ToolKind): string {
  switch (toolKind) {
    case 'mirror':
      return 'Mirror';
    case 'scale':
      return 'Scale';
    case 'shear':
      return 'Shear';
    case 'rotate':
      return 'Rotate';
    case 'general':
      return 'General';
    case 'translate':
      return 'Translate';
    case 'circleInversion':
      return 'Circle Inversion';
    case 'define':
    default:
      return 'Custom';
  }
}

export function clonePayload(payload: TransformPayload): TransformPayload {
  if (isLinearPayload(payload)) {
    return { ...payload };
  }

  if (isAffinePayload(payload)) {
    return {
      linear: { ...payload.linear },
      tx: payload.tx,
      ty: payload.ty,
    };
  }

  if (isProjectivePayload(payload)) {
    return { h: [...payload.h] };
  }

  return {
    a: cloneComplex(payload.a),
    b: cloneComplex(payload.b),
    c: cloneComplex(payload.c),
    d: cloneComplex(payload.d),
    anti: payload.anti,
  };
}

function isNumberDefined(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function isLinearPayload(payload: TransformPayload): payload is LinearData {
  return 'a11' in payload;
}

function isAffinePayload(payload: TransformPayload): payload is AffineData {
  return 'linear' in payload;
}

function isProjectivePayload(payload: TransformPayload): payload is ProjectiveData {
  return 'h' in payload;
}

function isMobiusPayload(payload: TransformPayload): payload is MobiusData {
  return 'anti' in payload;
}

function canonicalCircleInversionPayload(payload: TransformPayload): MobiusData {
  const fallbackRadiusSquared = 1;
  const radiusSquared =
    isMobiusPayload(payload) && payload.b ? Math.max(Math.abs(payload.b.re), EPSILON) : fallbackRadiusSquared;

  return {
    a: complex(0, 0),
    b: complex(radiusSquared, 0),
    c: complex(1, 0),
    d: complex(0, 0),
    anti: true,
  };
}

function isComplexDefined(value: MobiusData['a']): value is { re: number; im: number } {
  return value !== null && Number.isFinite(value.re) && Number.isFinite(value.im);
}

export function deriveStepStatus(step: TransformStep): Pick<TransformStep, 'isComplete' | 'isValid'> {
  switch (step.category) {
    case 'linear': {
      if (!isLinearPayload(step.payload)) {
        return { isComplete: false, isValid: false };
      }
      const complete =
        isNumberDefined(step.payload.a11) &&
        isNumberDefined(step.payload.a12) &&
        isNumberDefined(step.payload.a21) &&
        isNumberDefined(step.payload.a22);
      if (!complete) {
        return { isComplete: false, isValid: false };
      }
      const mat = toMat2(step.payload);
      let valid = Math.abs(det2(mat)) > EPSILON;
      if (step.toolKind === 'scale') {
        valid = valid && (step.payload.a11 ?? 0) > EPSILON && (step.payload.a22 ?? 0) > EPSILON;
      }
      return { isComplete: true, isValid: valid };
    }

    case 'affine': {
      if (!isAffinePayload(step.payload)) {
        return { isComplete: false, isValid: false };
      }
      const l = step.payload.linear;
      const complete =
        isNumberDefined(l.a11) &&
        isNumberDefined(l.a12) &&
        isNumberDefined(l.a21) &&
        isNumberDefined(l.a22) &&
        isNumberDefined(step.payload.tx) &&
        isNumberDefined(step.payload.ty);
      if (!complete) {
        return { isComplete: false, isValid: false };
      }
      const valid = Math.abs(det2(toMat2(l))) > EPSILON;
      return { isComplete: true, isValid: valid };
    }

    case 'projective': {
      if (!isProjectivePayload(step.payload)) {
        return { isComplete: false, isValid: false };
      }
      const complete = step.payload.h.length === 9 && step.payload.h.every(isNumberDefined);
      if (!complete) {
        return { isComplete: false, isValid: false };
      }
      const valid = Math.abs(det3(toMat3(step.payload))) > EPSILON;
      return { isComplete: true, isValid: valid };
    }

    case 'mobius':
    case 'antiMobius': {
      if (!isMobiusPayload(step.payload)) {
        return { isComplete: false, isValid: false };
      }
      const { a, b, c, d } = step.payload;
      const complete =
        isComplexDefined(a) &&
        isComplexDefined(b) &&
        isComplexDefined(c) &&
        isComplexDefined(d);

      if (!complete || !a || !b || !c || !d) {
        return { isComplete: false, isValid: false };
      }

      const determinant = subComplex(mulComplex(a, d), mulComplex(b, c));
      const detNonZero = abs2Complex(determinant) > EPSILON * EPSILON;

      if (step.toolKind === 'circleInversion') {
        const radiusSquared = b.re;
        const valid = detNonZero && radiusSquared > EPSILON;
        return { isComplete: true, isValid: valid };
      }

      return { isComplete: true, isValid: detNonZero };
    }

    default:
      return { isComplete: false, isValid: false };
  }
}

export function normalizeStep(step: TransformStep): TransformStep {
  let normalized: TransformStep = step;
  if (step.toolKind === 'circleInversion') {
    normalized = {
      ...step,
      category: 'antiMobius',
      payload: canonicalCircleInversionPayload(step.payload),
    };
  }

  const status = deriveStepStatus(normalized);
  return { ...normalized, ...status };
}

export function createStep(id: string, label: string, toolKind: ToolKind, category: Category): TransformStep {
  const payload = createInitialPayload(toolKind, category);
  return normalizeStep({
    id,
    label,
    toolKind,
    category,
    payload,
    isComplete: false,
    isValid: false,
    isVisible: true,
  });
}

export function liftStepToCategory(step: TransformStep, targetCategory: Category): TransformStep {
  if (targetCategory === 'affine' && step.category === 'linear' && isLinearPayload(step.payload)) {
    const lifted: TransformStep = {
      ...step,
      category: 'affine',
      toolKind: 'define',
      payload: {
        linear: { ...step.payload },
        tx: 0,
        ty: 0,
      },
    };
    return normalizeStep(lifted);
  }

  if (
    targetCategory === 'projective' &&
    (step.category === 'linear' || step.category === 'affine')
  ) {
    let h: number[];

    if (step.category === 'linear' && isLinearPayload(step.payload)) {
      h = [
        step.payload.a11 ?? 0,
        step.payload.a12 ?? 0,
        0,
        step.payload.a21 ?? 0,
        step.payload.a22 ?? 0,
        0,
        0,
        0,
        1,
      ];
    } else if (step.category === 'affine' && isAffinePayload(step.payload)) {
      h = [
        step.payload.linear.a11 ?? 0,
        step.payload.linear.a12 ?? 0,
        step.payload.tx ?? 0,
        step.payload.linear.a21 ?? 0,
        step.payload.linear.a22 ?? 0,
        -(step.payload.ty ?? 0),
        0,
        0,
        1,
      ];
    } else {
      return step;
    }

    const lifted: TransformStep = {
      ...step,
      category: 'projective',
      toolKind: 'define',
      payload: { h },
    };
    return normalizeStep(lifted);
  }

  return step;
}

export function toRuntimeSteps(steps: TransformStep[]): RuntimeStep[] {
  return steps.slice(0, MAX_STEPS).map(stepToRuntimeInverse);
}

export function stepToRuntimeInverse(step: TransformStep): RuntimeStep {
  if (!step.isComplete || !step.isValid) {
    return IDENTITY_RUNTIME_STEP;
  }

  if (step.category === 'linear' && isLinearPayload(step.payload)) {
    const inverse = invert2(toMat2(step.payload));
    if (!inverse) {
      return IDENTITY_RUNTIME_STEP;
    }
    return {
      type: 1,
      data1: [inverse[0], inverse[1], inverse[2], inverse[3]],
      data2: [0, 0, 0, 0],
      data3: [0, 0, 0, 0],
    };
  }

  if (step.category === 'affine' && isAffinePayload(step.payload)) {
    const mat = toMat2(step.payload.linear);
    const inverse = invert2(mat);
    if (!inverse || step.payload.tx === null || step.payload.ty === null) {
      return IDENTITY_RUNTIME_STEP;
    }
    const tx = -(inverse[0] * step.payload.tx + inverse[1] * step.payload.ty);
    const ty = inverse[2] * step.payload.tx + inverse[3] * step.payload.ty;
    return {
      type: 2,
      data1: [inverse[0], inverse[1], inverse[2], inverse[3]],
      data2: [tx, ty, 0, 0],
      data3: [0, 0, 0, 0],
    };
  }

  if (step.category === 'projective' && isProjectivePayload(step.payload)) {
    const inverse = invert3(toMat3(step.payload));
    if (!inverse) {
      return IDENTITY_RUNTIME_STEP;
    }

    return {
      type: 3,
      data1: [inverse[0], inverse[1], inverse[2], inverse[3]],
      data2: [inverse[4], inverse[5], inverse[6], inverse[7]],
      data3: [inverse[8], 0, 0, 0],
    };
  }

  if ((step.category === 'mobius' || step.category === 'antiMobius') && isMobiusPayload(step.payload)) {
    const { a, b, c, d, anti } = step.payload;
    if (!a || !b || !c || !d) {
      return IDENTITY_RUNTIME_STEP;
    }

    if (step.toolKind === 'circleInversion') {
      const radius = Math.sqrt(Math.abs(b.re));
      return {
        type: 6,
        data1: [radius, 0, 0, 0],
        data2: [0, 0, 0, 0],
        data3: [0, 0, 0, 0],
      };
    }

    const invA = d;
    const invB = negComplex(b);
    const invC = negComplex(c);
    const invD = a;

    return {
      type: anti ? 5 : 4,
      data1: [invA.re, invA.im, invB.re, invB.im],
      data2: [invC.re, invC.im, invD.re, invD.im],
      data3: [0, 0, 0, 0],
    };
  }

  return IDENTITY_RUNTIME_STEP;
}

export function updateLinearFromMat2(linear: LinearData, mat: Mat2): LinearData {
  return {
    ...linear,
    a11: mat[0],
    a12: mat[1],
    a21: mat[2],
    a22: mat[3],
  };
}

export function toAffineFromLinear(linear: LinearData): AffineData {
  return {
    linear: {
      ...linear,
    },
    tx: 0,
    ty: 0,
  };
}

export function isLinearStep(step: TransformStep): step is TransformStep & { payload: LinearData } {
  return step.category === 'linear' && isLinearPayload(step.payload);
}

export function isAffineStep(step: TransformStep): step is TransformStep & { payload: AffineData } {
  return step.category === 'affine' && isAffinePayload(step.payload);
}

export function isProjectiveStep(
  step: TransformStep,
): step is TransformStep & { payload: ProjectiveData } {
  return step.category === 'projective' && isProjectivePayload(step.payload);
}

export function isMobiusStep(step: TransformStep): step is TransformStep & { payload: MobiusData } {
  return (step.category === 'mobius' || step.category === 'antiMobius') && isMobiusPayload(step.payload);
}

export function linearValuesOrIdentity(linear: LinearData): Mat2 {
  if (
    linear.a11 === null ||
    linear.a12 === null ||
    linear.a21 === null ||
    linear.a22 === null
  ) {
    return [1, 0, 0, 1];
  }

  return [linear.a11, linear.a12, linear.a21, linear.a22];
}
