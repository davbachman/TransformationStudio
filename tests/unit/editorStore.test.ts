import React, { type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CameraSource, UploadSource } from '../../src/types/transforms';
import { EditorProvider, useEditorStore } from '../../src/state/editorStore';

function wrapper({ children }: PropsWithChildren) {
  return React.createElement(EditorProvider, null, children);
}

function makeUploadSource(name = 'sample.png'): UploadSource {
  return {
    kind: 'upload',
    bitmap: {} as ImageBitmap,
    width: 320,
    height: 240,
    textureReady: true,
    name,
  };
}

function makeCameraSource(): CameraSource {
  return {
    kind: 'camera',
    video: document.createElement('video'),
    stream: {
      getTracks: () => [],
      getVideoTracks: () => [],
    } as unknown as MediaStream,
    width: 640,
    height: 480,
    textureReady: true,
    name: 'Live Camera',
    mirrorPreview: true,
  };
}

describe('editorStore camera source flow', () => {
  it('sets upload source and camera state defaults', () => {
    const { result } = renderHook(() => useEditorStore(), { wrapper });
    act(() => {
      result.current.setSource(makeUploadSource());
    });

    expect(result.current.state.source?.kind).toBe('upload');
    expect(result.current.state.cameraStatus).toBe('idle');
    expect(result.current.state.cameraError).toBeNull();
  });

  it('tracks camera starting/live states', () => {
    const { result } = renderHook(() => useEditorStore(), { wrapper });
    act(() => {
      result.current.setCameraStarting();
    });
    expect(result.current.state.cameraStatus).toBe('starting');

    act(() => {
      result.current.setCameraLive();
    });
    expect(result.current.state.cameraStatus).toBe('live');
  });

  it('clears source and returns camera state to idle', () => {
    const { result } = renderHook(() => useEditorStore(), { wrapper });
    act(() => {
      result.current.setSource(makeCameraSource());
    });
    expect(result.current.state.source?.kind).toBe('camera');

    act(() => {
      result.current.clearSource();
    });

    expect(result.current.state.source).toBeNull();
    expect(result.current.state.cameraStatus).toBe('idle');
  });

  it('preserves current source when camera reports an error', () => {
    const { result } = renderHook(() => useEditorStore(), { wrapper });
    act(() => {
      result.current.setSource(makeUploadSource('lesson.png'));
      result.current.setCameraStarting();
    });

    act(() => {
      result.current.setCameraError('Camera permission denied.');
    });

    expect(result.current.state.source?.kind).toBe('upload');
    expect(result.current.state.source && result.current.state.source.name).toBe('lesson.png');
    expect(result.current.state.cameraStatus).toBe('error');
    expect(result.current.state.cameraError).toBe('Camera permission denied.');
  });

  it('setAllVisibility still toggles source and all steps together', () => {
    const { result } = renderHook(() => useEditorStore(), { wrapper });
    act(() => {
      result.current.addTool('mirror', 'linear');
    });
    expect(result.current.state.steps).toHaveLength(1);
    expect(result.current.state.steps[0]?.isVisible).toBe(true);
    expect(result.current.state.showFirstImage).toBe(true);

    act(() => {
      result.current.setAllVisibility(false);
    });
    expect(result.current.state.showFirstImage).toBe(false);
    expect(result.current.state.steps[0]?.isVisible).toBe(false);

    act(() => {
      result.current.setAllVisibility(true);
    });
    expect(result.current.state.showFirstImage).toBe(true);
    expect(result.current.state.steps[0]?.isVisible).toBe(true);
  });
});
