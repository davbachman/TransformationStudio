import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LeftSidebar } from './ui/LeftSidebar';
import { TopToolbar } from './ui/TopToolbar';
import { RightSidebar } from './ui/RightSidebar';
import { CanvasViewport } from './ui/CanvasViewport';
import { useEditorStore } from './state/editorStore';
import type { CameraSource, UploadSource } from './types/transforms';

async function createUploadBitmap(file: File): Promise<ImageBitmap> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to load selected image.'));
      element.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return createImageBitmap(file);
    }

    // Keep texture orientation consistent across browsers by explicitly flipping once here.
    context.translate(0, canvas.height);
    context.scale(1, -1);
    context.drawImage(image, 0, 0);

    return createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function stopStreamTracks(stream: MediaStream | null | undefined) {
  if (!stream) {
    return;
  }
  stream.getTracks().forEach((track) => track.stop());
}

async function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for camera metadata.'));
    }, 3000);

    const onLoaded = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Unable to read camera metadata.'));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}

function formatCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Camera permission denied.';
    }
    if (error.name === 'NotFoundError') {
      return 'No camera found on this device.';
    }
    if (error.name === 'NotReadableError') {
      return 'Camera is busy or not readable.';
    }
  }
  return 'Unable to start camera.';
}

export default function App() {
  const {
    state,
    addTool,
    selectStep,
    deleteStep,
    clearSource,
    toggleStepVisibility,
    setAllVisibility,
    updateStepPayload,
    reorderSteps,
    setSource,
    setCameraStarting,
    setCameraLive,
    setCameraError,
    stopCameraState,
    toggleSquareGrid,
    togglePolarGrid,
    toggleFirstImage,
    clickCategory,
    undo,
    redo,
  } = useEditorStore();
  const suppressEndedRef = useRef(false);
  const cameraRequestIdRef = useRef(0);

  const selectedStep = useMemo(
    () => state.steps.find((step) => step.id === state.selectedStepId) ?? null,
    [state.selectedStepId, state.steps],
  );

  const onUpload = useCallback(
    async (file: File) => {
      cameraRequestIdRef.current += 1;
      if (state.source?.kind === 'camera') {
        suppressEndedRef.current = true;
        stopStreamTracks(state.source.stream);
        window.setTimeout(() => {
          suppressEndedRef.current = false;
        }, 0);
      }

      const bitmap = await createUploadBitmap(file);
      const source: UploadSource = {
        kind: 'upload',
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        textureReady: true,
        name: file.name,
      };
      setSource(source);
    },
    [setSource, state.source],
  );

  const handleCameraEnded = useCallback(() => {
    if (suppressEndedRef.current) {
      return;
    }
    stopCameraState();
    setCameraError('Camera stopped.');
  }, [setCameraError, stopCameraState]);

  const startCamera = useCallback(async () => {
    const requestId = cameraRequestIdRef.current + 1;
    cameraRequestIdRef.current = requestId;

    if (!window.isSecureContext) {
      setCameraError('Camera requires HTTPS or localhost.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is unavailable in this browser.');
      return;
    }

    setCameraStarting();

    let stream: MediaStream | null = null;
    try {
      if (state.source?.kind === 'camera') {
        suppressEndedRef.current = true;
        stopStreamTracks(state.source.stream);
        window.setTimeout(() => {
          suppressEndedRef.current = false;
        }, 0);
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      if (requestId !== cameraRequestIdRef.current) {
        stopStreamTracks(stream);
        return;
      }

      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      await video.play();
      await waitForVideoMetadata(video);

      if (requestId !== cameraRequestIdRef.current) {
        stopStreamTracks(stream);
        return;
      }

      const cameraSource: CameraSource = {
        kind: 'camera',
        video,
        stream,
        width: video.videoWidth || 640,
        height: video.videoHeight || 480,
        textureReady: true,
        name: 'Live Camera',
        mirrorPreview: true,
      };

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', handleCameraEnded, { once: true });
      });

      setSource(cameraSource);
      setCameraLive();
    } catch (error) {
      stopStreamTracks(stream);
      setCameraError(formatCameraError(error));
    }
  }, [handleCameraEnded, setCameraError, setCameraLive, setCameraStarting, setSource, state.source]);

  const stopCamera = useCallback(() => {
    cameraRequestIdRef.current += 1;
    if (state.source?.kind === 'camera') {
      suppressEndedRef.current = true;
      stopStreamTracks(state.source.stream);
      window.setTimeout(() => {
        suppressEndedRef.current = false;
      }, 0);
    }

    clearSource();
    stopCameraState();
  }, [clearSource, state.source, stopCameraState]);

  useEffect(() => {
    return () => {
      cameraRequestIdRef.current += 1;
      if (state.source?.kind === 'camera') {
        suppressEndedRef.current = true;
        stopStreamTracks(state.source.stream);
      }
    };
  }, [state.source]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const hotkey = event.metaKey || event.ctrlKey;
      if (!hotkey) {
        return;
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [redo, undo]);

  return (
    <div className="app-shell">
      <TopToolbar
        onUpload={onUpload}
        cameraStatus={state.cameraStatus}
        cameraError={state.cameraError}
        showSquareGrid={state.showSquareGrid}
        showPolarGrid={state.showPolarGrid}
        onToggleCamera={() => {
          if (state.cameraStatus === 'live' || state.cameraStatus === 'starting') {
            stopCamera();
            return;
          }
          void startCamera();
        }}
        onToggleSquareGrid={toggleSquareGrid}
        onTogglePolarGrid={togglePolarGrid}
      />

      <LeftSidebar
        activeCategory={state.activeCategory}
        selectedStep={selectedStep}
        onCategoryClick={clickCategory}
        onAddTool={addTool}
        onUpdatePayload={updateStepPayload}
      />

      <CanvasViewport
        source={state.source}
        steps={state.steps}
        selectedStep={selectedStep}
        showFirstImage={state.showFirstImage}
        showSquareGrid={state.showSquareGrid}
        showPolarGrid={state.showPolarGrid}
        onUpdatePayload={updateStepPayload}
      />

      <RightSidebar
        steps={state.steps}
        selectedStepId={state.selectedStepId}
        hasSource={Boolean(state.source)}
        sourceLabel={state.source?.kind === 'camera' ? 'Source Camera' : 'Source Image'}
        showFirstImage={state.showFirstImage}
        onSelect={selectStep}
        onDelete={deleteStep}
        onDeleteSource={stopCamera}
        onToggleStepVisibility={toggleStepVisibility}
        onToggleSourceVisibility={toggleFirstImage}
        onToggleAllImages={() => {
          const allHidden = !state.showFirstImage && state.steps.every((step) => !step.isVisible);
          setAllVisibility(allHidden);
        }}
        onReorder={reorderSteps}
      />
    </div>
  );
}
