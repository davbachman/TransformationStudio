export type Mat2 = [number, number, number, number];
export type Mat3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const MATRIX_EPSILON = 1e-8;

export function det2(m: Mat2): number {
  return m[0] * m[3] - m[1] * m[2];
}

export function invert2(m: Mat2): Mat2 | null {
  const determinant = det2(m);
  if (Math.abs(determinant) < MATRIX_EPSILON) {
    return null;
  }
  const invDet = 1 / determinant;
  return [m[3] * invDet, -m[1] * invDet, -m[2] * invDet, m[0] * invDet];
}

export function multiply2Vec2(m: Mat2, x: number, y: number): [number, number] {
  return [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
}

export function det3(m: Mat3): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

export function invert3(m: Mat3): Mat3 | null {
  const determinant = det3(m);
  if (Math.abs(determinant) < MATRIX_EPSILON) {
    return null;
  }

  const invDet = 1 / determinant;
  const m00 = (m[4] * m[8] - m[5] * m[7]) * invDet;
  const m01 = (m[2] * m[7] - m[1] * m[8]) * invDet;
  const m02 = (m[1] * m[5] - m[2] * m[4]) * invDet;

  const m10 = (m[5] * m[6] - m[3] * m[8]) * invDet;
  const m11 = (m[0] * m[8] - m[2] * m[6]) * invDet;
  const m12 = (m[2] * m[3] - m[0] * m[5]) * invDet;

  const m20 = (m[3] * m[7] - m[4] * m[6]) * invDet;
  const m21 = (m[1] * m[6] - m[0] * m[7]) * invDet;
  const m22 = (m[0] * m[4] - m[1] * m[3]) * invDet;

  return [m00, m01, m02, m10, m11, m12, m20, m21, m22];
}

export function rotationMatrix(theta: number): Mat2 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [c, -s, s, c];
}

export function reflectionMatrix(theta: number): Mat2 {
  const c2 = Math.cos(2 * theta);
  const s2 = Math.sin(2 * theta);
  return [c2, s2, s2, -c2];
}

export function shearMatrix(k: number): Mat2 {
  return [1, k, 0, 1];
}

export function scaleMatrix(s: number): Mat2 {
  return [s, 0, 0, s];
}
