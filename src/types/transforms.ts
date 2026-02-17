export type Category = 'linear' | 'affine' | 'projective' | 'mobius' | 'antiMobius';

export type ToolKind =
  | 'mirror'
  | 'scale'
  | 'shear'
  | 'rotate'
  | 'general'
  | 'translate'
  | 'circleInversion'
  | 'define';

export interface Complex {
  re: number;
  im: number;
}

export interface LinearData {
  a11: number | null;
  a12: number | null;
  a21: number | null;
  a22: number | null;
}

export interface AffineData {
  linear: LinearData;
  tx: number | null;
  ty: number | null;
}

export interface ProjectiveData {
  h: Array<number | null>;
}

export interface MobiusData {
  a: Complex | null;
  b: Complex | null;
  c: Complex | null;
  d: Complex | null;
  anti: boolean;
}

export type TransformPayload = LinearData | AffineData | ProjectiveData | MobiusData;

export interface TransformStep {
  id: string;
  label: string;
  toolKind: ToolKind;
  category: Category;
  payload: TransformPayload;
  isComplete: boolean;
  isValid: boolean;
  isVisible: boolean;
}

export interface EditorImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  textureReady: boolean;
  name: string;
}

export interface EditorState {
  image: EditorImage | null;
  steps: TransformStep[];
  selectedStepId: string | null;
  activeCategory: Category;
  showSquareGrid: boolean;
  showPolarGrid: boolean;
  showFirstImage: boolean;
}

export interface RuntimeStep {
  type: number;
  data1: [number, number, number, number];
  data2: [number, number, number, number];
  data3: [number, number, number, number];
}

export const MAX_STEPS = 40;
