import { useEffect, useState, type ReactNode } from 'react';
import type {
  AffineData,
  LinearData,
  MobiusData,
  ProjectiveData,
  TransformPayload,
  TransformStep,
} from '../types/transforms';

interface MatrixPanelProps {
  step: TransformStep | null;
  onUpdatePayload: (stepId: string, payload: TransformPayload) => void;
}

function toInputString(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '';
  }
  return String(value);
}

function parseNumberInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

interface NumericCellProps {
  value: number | null;
  onCommit: (value: number | null) => void;
  className?: string;
  readOnly?: boolean;
}

function NumericCell({ value, onCommit, className, readOnly = false }: NumericCellProps) {
  const [text, setText] = useState<string>(() => toInputString(value));

  useEffect(() => {
    setText(toInputString(value));
  }, [value]);

  return (
    <input
      className={`matrix-input ${readOnly ? 'is-readonly' : ''} ${className ?? ''}`}
      type="text"
      inputMode="decimal"
      value={text}
      readOnly={readOnly}
      onChange={(event) => {
        if (readOnly) {
          return;
        }
        const nextText = event.target.value;
        setText(nextText);
        const parsed = parseNumberInput(nextText);
        if (parsed !== undefined) {
          onCommit(parsed);
        }
      }}
    />
  );
}

function BracketedBlock({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="equation-bracketed">
      <span className="equation-bracket equation-bracket-left" />
      <div className="equation-bracket-content">{children}</div>
      <span className="equation-bracket equation-bracket-right" />
    </div>
  );
}

function LinearMatrixEditor({
  step,
  onUpdate,
}: {
  step: TransformStep;
  onUpdate: (payload: TransformPayload) => void;
}) {
  const payload = step.payload as LinearData;

  return (
    <div className="equation-editor">
      <div className="equation-row">
        <BracketedBlock>
          <div className="equation-grid-2x2">
            <NumericCell
              value={payload.a11}
              className="equation-input"
              onCommit={(value) => onUpdate({ ...payload, a11: value })}
            />
            <NumericCell
              value={payload.a12}
              className="equation-input"
              onCommit={(value) => onUpdate({ ...payload, a12: value })}
            />
            <NumericCell
              value={payload.a21}
              className="equation-input"
              onCommit={(value) => onUpdate({ ...payload, a21: value })}
            />
            <NumericCell
              value={payload.a22}
              className="equation-input"
              onCommit={(value) => onUpdate({ ...payload, a22: value })}
            />
          </div>
        </BracketedBlock>

        <BracketedBlock>
          <div className="equation-grid-2x1 equation-grid-2x1-vars equation-vars">
            <span>x</span>
            <span>y</span>
          </div>
        </BracketedBlock>
      </div>
    </div>
  );
}

function AffineMatrixEditor({
  step,
  onUpdate,
}: {
  step: TransformStep;
  onUpdate: (payload: TransformPayload) => void;
}) {
  const payload = step.payload as AffineData;

  return (
    <div className="equation-editor">
      <div className="equation-row">
        <BracketedBlock>
          <div className="equation-grid-2x2">
            <NumericCell
              value={payload.linear.a11}
              className="equation-input"
              onCommit={(value) =>
                onUpdate({
                  ...payload,
                  linear: {
                    ...payload.linear,
                    a11: value,
                  },
                })}
            />
            <NumericCell
              value={payload.linear.a12}
              className="equation-input"
              onCommit={(value) =>
                onUpdate({
                  ...payload,
                  linear: {
                    ...payload.linear,
                    a12: value,
                  },
                })}
            />
            <NumericCell
              value={payload.linear.a21}
              className="equation-input"
              onCommit={(value) =>
                onUpdate({
                  ...payload,
                  linear: {
                    ...payload.linear,
                    a21: value,
                  },
                })}
            />
            <NumericCell
              value={payload.linear.a22}
              className="equation-input"
              onCommit={(value) =>
                onUpdate({
                  ...payload,
                  linear: {
                    ...payload.linear,
                    a22: value,
                  },
                })}
            />
          </div>
        </BracketedBlock>

        <BracketedBlock>
          <div className="equation-grid-2x1 equation-grid-2x1-vars equation-vars">
            <span>x</span>
            <span>y</span>
          </div>
        </BracketedBlock>

        <span className="equation-plus">+</span>

        <BracketedBlock>
          <div className="equation-grid-2x1">
            <NumericCell
              value={payload.tx}
              className="equation-input"
              onCommit={(tx) => onUpdate({ ...payload, tx })}
            />
            <NumericCell
              value={payload.ty}
              className="equation-input"
              onCommit={(ty) => onUpdate({ ...payload, ty })}
            />
          </div>
        </BracketedBlock>
      </div>
    </div>
  );
}

function ProjectiveMatrixEditor({
  step,
  onUpdate,
}: {
  step: TransformStep;
  onUpdate: (payload: TransformPayload) => void;
}) {
  const payload = step.payload as ProjectiveData;

  return (
    <div className="equation-editor">
      <div className="equation-row">
        <BracketedBlock>
          <div className="equation-grid-3x3">
            {payload.h.map((value, index) => (
              <NumericCell
                key={`h-${index}`}
                value={value}
                className="equation-input"
                onCommit={(nextValue) => {
                  const next = [...payload.h];
                  next[index] = nextValue;
                  onUpdate({ h: next });
                }}
              />
            ))}
          </div>
        </BracketedBlock>

        <BracketedBlock>
          <div className="equation-grid-3x1 equation-grid-3x1-vars equation-vars">
            <span>x</span>
            <span>y</span>
            <span>1</span>
          </div>
        </BracketedBlock>
      </div>
    </div>
  );
}

function MobiusEditor({
  step,
  onUpdate,
}: {
  step: TransformStep;
  onUpdate: (payload: TransformPayload) => void;
}) {
  const payload = step.payload as MobiusData;

  const updatePart = (key: 'a' | 'b' | 'c' | 'd', part: 're' | 'im', nextValue: number | null) => {
    const existing = payload[key];
    let nextCoeff: { re: number; im: number } | null = null;

    if (nextValue !== null) {
      nextCoeff = {
        re: part === 're' ? nextValue : existing?.re ?? 0,
        im: part === 'im' ? nextValue : existing?.im ?? 0,
      };
    }

    onUpdate({
      ...payload,
      [key]: nextCoeff,
    });
  };

  const complexField = (key: 'a' | 'b' | 'c' | 'd') => (
    <span className="mobius-coeff">
      <span className="mobius-coeff-paren">(</span>
      <NumericCell
        value={payload[key]?.re ?? null}
        className="mobius-input"
        onCommit={(v) => updatePart(key, 're', v)}
      />
      <span className="mobius-coeff-sign">+</span>
      <NumericCell
        value={payload[key]?.im ?? null}
        className="mobius-input"
        onCommit={(v) => updatePart(key, 'im', v)}
      />
      <span className="mobius-i">i</span>
      <span className="mobius-coeff-paren">)</span>
    </span>
  );

  return (
    <div className="mobius-editor">
      <div className="mobius-fraction">
        <div className="mobius-fraction-row">
          {complexField('a')}
          <span className={`mobius-z ${payload.anti ? 'mobius-z-conj' : ''}`}>z</span>
          <span className="mobius-op">+</span>
          {complexField('b')}
        </div>
        <div className="mobius-fraction-bar" />
        <div className="mobius-fraction-row">
          {complexField('c')}
          <span className={`mobius-z ${payload.anti ? 'mobius-z-conj' : ''}`}>z</span>
          <span className="mobius-op">+</span>
          {complexField('d')}
        </div>
      </div>
      <div className="complex-hint">Each coefficient is shown as real + imaginary i.</div>
    </div>
  );
}

function CircleInversionEditor({
  step,
  onUpdate,
}: {
  step: TransformStep;
  onUpdate: (payload: TransformPayload) => void;
}) {
  const payload = step.payload as MobiusData;
  const bReal = Math.max(Math.abs(payload.b?.re ?? 1), 1e-8);

  const setBReal = (value: number | null) => {
    if (value === null) {
      return;
    }
    const safe = Math.max(Math.abs(value), 1e-8);
    onUpdate({
      a: { re: 0, im: 0 },
      b: { re: safe, im: 0 },
      c: { re: 1, im: 0 },
      d: { re: 0, im: 0 },
      anti: true,
    });
  };

  return (
    <div className="mobius-editor">
      <div className="mobius-fraction">
        <div className="mobius-fraction-row">
          <span className="mobius-coeff">
            <span className="mobius-coeff-paren">(</span>
            <NumericCell value={0} className="mobius-input" readOnly onCommit={() => undefined} />
            <span className="mobius-coeff-sign">+</span>
            <NumericCell value={0} className="mobius-input" readOnly onCommit={() => undefined} />
            <span className="mobius-i">i</span>
            <span className="mobius-coeff-paren">)</span>
          </span>
          <span className="mobius-z mobius-z-conj">z</span>
          <span className="mobius-op">+</span>
          <span className="mobius-coeff">
            <span className="mobius-coeff-paren">(</span>
            <NumericCell value={bReal} className="mobius-input" onCommit={setBReal} />
            <span className="mobius-coeff-sign">+</span>
            <NumericCell value={0} className="mobius-input" readOnly onCommit={() => undefined} />
            <span className="mobius-i">i</span>
            <span className="mobius-coeff-paren">)</span>
          </span>
        </div>
        <div className="mobius-fraction-bar" />
        <div className="mobius-fraction-row">
          <span className="mobius-coeff">
            <span className="mobius-coeff-paren">(</span>
            <NumericCell value={1} className="mobius-input" readOnly onCommit={() => undefined} />
            <span className="mobius-coeff-sign">+</span>
            <NumericCell value={0} className="mobius-input" readOnly onCommit={() => undefined} />
            <span className="mobius-i">i</span>
            <span className="mobius-coeff-paren">)</span>
          </span>
          <span className="mobius-z mobius-z-conj">z</span>
          <span className="mobius-op">+</span>
          <span className="mobius-coeff">
            <span className="mobius-coeff-paren">(</span>
            <NumericCell value={0} className="mobius-input" readOnly onCommit={() => undefined} />
            <span className="mobius-coeff-sign">+</span>
            <NumericCell value={0} className="mobius-input" readOnly onCommit={() => undefined} />
            <span className="mobius-i">i</span>
            <span className="mobius-coeff-paren">)</span>
          </span>
        </div>
      </div>
      <div className="complex-hint">
        Circle inversion is shown in anti-Mobius form; center-lock is enforced ({' '}a=0, c=1, d=0, Im(b)=0).
      </div>
    </div>
  );
}

export function MatrixPanel({ step, onUpdatePayload }: MatrixPanelProps) {
  if (!step) {
    return (
      <section className="matrix-panel">
        <div className="matrix-header">Matrix Definition</div>
        <p className="matrix-placeholder">Select a transformation on the right to edit its entries.</p>
      </section>
    );
  }

  const onUpdate = (payload: TransformPayload) => {
    onUpdatePayload(step.id, payload);
  };

  return (
    <section className="matrix-panel">
      <div className="matrix-header">Matrix Definition</div>
      <div className="matrix-subheader">
        <span>{step.label}</span>
        <span className={`status-pill ${step.isValid ? 'ok' : 'warn'}`}>
          {step.isComplete ? (step.isValid ? 'valid' : 'invalid') : 'incomplete'}
        </span>
      </div>

      {step.category === 'linear' && <LinearMatrixEditor step={step} onUpdate={onUpdate} />}
      {step.category === 'affine' && <AffineMatrixEditor step={step} onUpdate={onUpdate} />}
      {step.category === 'projective' && <ProjectiveMatrixEditor step={step} onUpdate={onUpdate} />}
      {step.toolKind === 'circleInversion' && step.category === 'antiMobius' && (
        <CircleInversionEditor step={step} onUpdate={onUpdate} />
      )}
      {step.toolKind !== 'circleInversion' && (step.category === 'mobius' || step.category === 'antiMobius') && (
        <MobiusEditor step={step} onUpdate={onUpdate} />
      )}
    </section>
  );
}
