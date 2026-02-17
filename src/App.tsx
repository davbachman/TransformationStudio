import { useCallback, useEffect, useMemo } from 'react';
import { LeftSidebar } from './ui/LeftSidebar';
import { TopToolbar } from './ui/TopToolbar';
import { RightSidebar } from './ui/RightSidebar';
import { CanvasViewport } from './ui/CanvasViewport';
import { useEditorStore } from './state/editorStore';

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

export default function App() {
  const {
    state,
    addTool,
    selectStep,
    deleteStep,
    clearImage,
    toggleStepVisibility,
    setAllVisibility,
    updateStepPayload,
    reorderSteps,
    setImage,
    toggleSquareGrid,
    togglePolarGrid,
    toggleFirstImage,
    clickCategory,
    undo,
    redo,
  } = useEditorStore();

  const selectedStep = useMemo(
    () => state.steps.find((step) => step.id === state.selectedStepId) ?? null,
    [state.selectedStepId, state.steps],
  );

  const onUpload = useCallback(
    async (file: File) => {
      const bitmap = await createUploadBitmap(file);
      setImage({
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        textureReady: true,
        name: file.name,
      });
    },
    [setImage],
  );

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
        showSquareGrid={state.showSquareGrid}
        showPolarGrid={state.showPolarGrid}
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
        image={state.image}
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
        hasImage={Boolean(state.image)}
        showFirstImage={state.showFirstImage}
        onSelect={selectStep}
        onDelete={deleteStep}
        onDeleteSource={clearImage}
        onToggleStepVisibility={toggleStepVisibility}
        onToggleSourceVisibility={toggleFirstImage}
        onToggleAllImages={() =>
          setAllVisibility(!(state.showFirstImage && state.steps.every((step) => step.isVisible)))
        }
        onReorder={reorderSteps}
      />
    </div>
  );
}
