import { useCallback, useEffect, useMemo } from 'react';
import { LeftSidebar } from './ui/LeftSidebar';
import { TopToolbar } from './ui/TopToolbar';
import { RightSidebar } from './ui/RightSidebar';
import { CanvasViewport } from './ui/CanvasViewport';
import { useEditorStore } from './state/editorStore';

export default function App() {
  const {
    state,
    addTool,
    selectStep,
    deleteStep,
    updateStepPayload,
    reorderSteps,
    setImage,
    toggleSquareGrid,
    togglePolarGrid,
    toggleHistory,
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
      let bitmap: ImageBitmap;
      try {
        // ImageBitmap upload in WebGL ignores UNPACK_FLIP_Y_WEBGL; request flip at decode time.
        bitmap = await createImageBitmap(file, { imageOrientation: 'flipY' });
      } catch {
        bitmap = await createImageBitmap(file);
      }
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
        showHistory={state.showHistory}
        onToggleSquareGrid={toggleSquareGrid}
        onTogglePolarGrid={togglePolarGrid}
        onToggleHistory={toggleHistory}
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
        showHistory={state.showHistory}
        showSquareGrid={state.showSquareGrid}
        showPolarGrid={state.showPolarGrid}
        onUpdatePayload={updateStepPayload}
      />

      <RightSidebar
        steps={state.steps}
        selectedStepId={state.selectedStepId}
        onSelect={selectStep}
        onDelete={deleteStep}
        onReorder={reorderSteps}
      />
    </div>
  );
}
