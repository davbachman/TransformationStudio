import { useRef, useState } from 'react';

interface TopToolbarProps {
  onUpload: (file: File) => Promise<void>;
  cameraStatus: 'idle' | 'starting' | 'live' | 'error';
  cameraError: string | null;
  showSquareGrid: boolean;
  showPolarGrid: boolean;
  onToggleCamera: () => void;
  onToggleSquareGrid: () => void;
  onTogglePolarGrid: () => void;
}

export function TopToolbar({
  onUpload,
  cameraStatus,
  cameraError,
  showSquareGrid,
  showPolarGrid,
  onToggleCamera,
  onToggleSquareGrid,
  onTogglePolarGrid,
}: TopToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showAbout, setShowAbout] = useState(false);

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
    <>
      <header className="top-toolbar">
        <div className="toolbar-brand-group">
          <div className="toolbar-brand">Transformation Studio</div>
          <button type="button" className="btn toolbar-about-btn" onClick={() => setShowAbout(true)}>
            About
          </button>
        </div>

        <div className="toolbar-controls">
          <button type="button" className="btn" onClick={triggerUpload}>
            Upload Image
          </button>
          <button
            type="button"
            className={`btn ${cameraStatus === 'live' ? 'is-active' : ''}`}
            disabled={cameraStatus === 'starting'}
            onClick={onToggleCamera}
          >
            {cameraStatus === 'live' || cameraStatus === 'starting' ? 'Stop Camera' : 'Use Camera'}
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

          {cameraError && <div className="camera-error-inline">{cameraError}</div>}
        </div>
      </header>

      {showAbout && (
        <div
          className="about-modal-backdrop"
          onClick={() => setShowAbout(false)}
          role="presentation"
        >
          <div
            className="about-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="about-modal-header">
              <div id="about-modal-title" className="about-modal-title">
                About Transformation Studio
              </div>
              <button
                type="button"
                className="about-close-btn"
                aria-label="Close About dialog"
                onClick={() => setShowAbout(false)}
              >
                ×
              </button>
            </div>

            <div className="about-modal-body">
              <p>Author: David Bachman, GPT 5.3 codex</p>
              <p>
                <a
                  href="https://github.com/davbachman/TransformationStudio"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instructions and Code
                </a>
              </p>
              <p>
                <a
                  href="https://profbachman.substack.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Learn more about AI
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
