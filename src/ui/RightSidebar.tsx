import type { TransformStep } from '../types/transforms';
import { TransformList } from './TransformList';

interface RightSidebarProps {
  steps: TransformStep[];
  selectedStepId: string | null;
  onSelect: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onReorder: (dragId: string, targetId: string) => void;
}

export function RightSidebar({ steps, selectedStepId, onSelect, onDelete, onReorder }: RightSidebarProps) {
  return (
    <aside className="right-sidebar">
      <div className="sidebar-title">Transformation Stack</div>
      <TransformList
        steps={steps}
        selectedStepId={selectedStepId}
        onSelect={onSelect}
        onDelete={onDelete}
        onReorder={onReorder}
      />
    </aside>
  );
}
