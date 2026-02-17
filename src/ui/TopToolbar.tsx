import { useRef } from 'react';

interface TopToolbarProps {
  onUpload: (file: File) => Promise<void>;
  showSquareGrid: boolean;
  showPolarGrid: boolean;
  onToggleSquareGrid: () => void;
  onTogglePolarGrid: () => void;
}

export function TopToolbar({
  onUpload,
  showSquareGrid,
  showPolarGrid,
  onToggleSquareGrid,
  onTogglePolarGrid,
}: TopToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await onUpload(file);
    event.target.value = '';
  };

  return (
    <header className="top-toolbar">
      <div className="toolbar-brand">Transformation Studio</div>

      <div className="toolbar-controls">
        <button type="button" className="btn" onClick={triggerUpload}>
          Upload Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden-input"
          onChange={onFileChange}
        />

        <button
          type="button"
          className={`btn ${showSquareGrid ? 'is-active' : ''}`}
          onClick={onToggleSquareGrid}
        >
          Square Grid
        </button>

        <button
          type="button"
          className={`btn ${showPolarGrid ? 'is-active' : ''}`}
          onClick={onTogglePolarGrid}
        >
          Polar Grid
        </button>

      </div>
    </header>
  );
}
