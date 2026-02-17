import type { TransformStep } from '../types/transforms';
import { TransformList } from './TransformList';

interface RightSidebarProps {
  steps: TransformStep[];
  selectedStepId: string | null;
  showFirstImage: boolean;
  onSelect: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onToggleStepVisibility: (stepId: string) => void;
  onToggleFirstImage: () => void;
  onToggleAllImages: () => void;
  onReorder: (dragId: string, targetId: string) => void;
}

export function RightSidebar({
  steps,
  selectedStepId,
  showFirstImage,
  onSelect,
  onDelete,
  onToggleStepVisibility,
  onToggleFirstImage,
  onToggleAllImages,
  onReorder,
}: RightSidebarProps) {
  const allVisible = showFirstImage && steps.every((step) => step.isVisible);

  return (
    <aside className="right-sidebar">
      <div className="sidebar-title">Transformation Stack</div>
      <div className="stack-visibility-controls">
        <button type="button" className="stack-toggle-btn" onClick={onToggleFirstImage}>
          {showFirstImage ? 'Hide first' : 'Show first'}
        </button>
        <button type="button" className="stack-toggle-btn" onClick={onToggleAllImages}>
          {allVisible ? 'Hide all' : 'Show all'}
        </button>
      </div>
      <TransformList
        steps={steps}
        selectedStepId={selectedStepId}
        onSelect={onSelect}
        onDelete={onDelete}
        onToggleVisibility={onToggleStepVisibility}
        onReorder={onReorder}
      />
    </aside>
  );
}
