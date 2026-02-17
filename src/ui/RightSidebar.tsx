import type { TransformStep } from '../types/transforms';
import { TransformList } from './TransformList';

interface RightSidebarProps {
  steps: TransformStep[];
  selectedStepId: string | null;
  hasImage: boolean;
  showFirstImage: boolean;
  onSelect: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onDeleteSource: () => void;
  onToggleStepVisibility: (stepId: string) => void;
  onToggleSourceVisibility: () => void;
  onToggleAllImages: () => void;
  onReorder: (dragId: string, targetId: string) => void;
}

export function RightSidebar({
  steps,
  selectedStepId,
  hasImage,
  showFirstImage,
  onSelect,
  onDelete,
  onDeleteSource,
  onToggleStepVisibility,
  onToggleSourceVisibility,
  onToggleAllImages,
  onReorder,
}: RightSidebarProps) {
  const allVisible = showFirstImage && steps.every((step) => step.isVisible);

  return (
    <aside className="right-sidebar">
      <div className="sidebar-title">Transformation Stack</div>
      <div className="stack-visibility-controls">
        <button type="button" className="stack-toggle-btn" onClick={onToggleAllImages}>
          {allVisible ? 'Hide all' : 'Show all'}
        </button>
      </div>
      <TransformList
        steps={steps}
        selectedStepId={selectedStepId}
        hasImage={hasImage}
        showSourceImage={showFirstImage}
        onSelect={onSelect}
        onDelete={onDelete}
        onToggleVisibility={onToggleStepVisibility}
        onToggleSourceVisibility={onToggleSourceVisibility}
        onDeleteSource={onDeleteSource}
        onReorder={onReorder}
      />
    </aside>
  );
}
