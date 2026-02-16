import type { Complex } from '../types/transforms';

export const COMPLEX_EPSILON = 1e-8;

export function complex(re: number, im: number): Complex {
  return { re, im };
}

export function addComplex(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function subComplex(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function mulComplex(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function divComplex(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom < COMPLEX_EPSILON) {
    return { re: NaN, im: NaN };
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

export function conjComplex(z: Complex): Complex {
  return { re: z.re, im: -z.im };
}

export function negComplex(z: Complex): Complex {
  return { re: -z.re, im: -z.im };
}

export function abs2Complex(z: Complex): number {
  return z.re * z.re + z.im * z.im;
}

export function isZeroComplex(z: Complex, epsilon = COMPLEX_EPSILON): boolean {
  return abs2Complex(z) <= epsilon * epsilon;
}

export function cloneComplex(z: Complex | null): Complex | null {
  if (!z) {
    return null;
  }
  return { re: z.re, im: z.im };
}
