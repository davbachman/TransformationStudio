import type { Category, ToolKind, TransformPayload, TransformStep } from '../types/transforms';
import { CATEGORY_TOOLS, toolLabel } from '../math/transformEval';
import { MatrixPanel } from './MatrixPanel';

interface LeftSidebarProps {
  activeCategory: Category;
  selectedStep: TransformStep | null;
  onCategoryClick: (category: Category) => void;
  onAddTool: (toolKind: ToolKind, category: Category) => void;
  onUpdatePayload: (stepId: string, payload: TransformPayload) => void;
}

const CATEGORY_LABEL: Record<Category, string> = {
  linear: 'Linear',
  affine: 'Affine',
  projective: 'Projective',
  mobius: 'Mobius',
  antiMobius: 'Anti-Mobius',
};

export function LeftSidebar({
  activeCategory,
  selectedStep,
  onCategoryClick,
  onAddTool,
  onUpdatePayload,
}: LeftSidebarProps) {
  const categories = Object.keys(CATEGORY_TOOLS) as Category[];

  return (
    <aside className="left-sidebar">
      <div className="tool-groups">
        {categories.map((category) => (
          <section key={category} className="tool-group">
            <button
              type="button"
              className={`category-title ${activeCategory === category ? 'is-active' : ''}`}
              onClick={() => onCategoryClick(category)}
            >
              {CATEGORY_LABEL[category]}
            </button>

            <div className="tool-buttons">
              {CATEGORY_TOOLS[category].map((toolKind) => (
                <button
                  key={`${category}-${toolKind}`}
                  type="button"
                  className="tool-btn"
                  onClick={() => onAddTool(toolKind, category)}
                >
                  {toolLabel(toolKind)}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <MatrixPanel step={selectedStep} onUpdatePayload={onUpdatePayload} />
    </aside>
  );
}
