import { useEffect, useRef, useState } from 'react';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { api } from '../../api/client';

/**
 * Wires a control-panel file input to the cropper: selecting a profile/cover image
 * opens the crop modal (after the blade's 250×250 minimum check); cropping uploads the
 * 1095×1080 result and saves it. Shared by every control-panel modal so the behaviour
 * cannot drift.
 */
export function useCropUpload(onSaved: (filename: string, kind: 'profile' | 'cover') => void) {
  const [crop, setCrop] = useState<{ src: string; type: 'profile' | 'cover' } | null>(null);

  function onFileChange(kind: 'profile' | 'cover', file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const probe = new Image();
      probe.onload = () => {
        if (probe.width < 250 || probe.height < 250) {
          alert('Image too small. Minimum size is 250x250.');
          return;
        }
        setCrop({ src: dataUrl, type: kind });
      };
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function upload(dataUrl: string) {
    if (!crop) return;
    const { data } = await api.post<{ filename: string }>(
      crop.type === 'profile' ? '/uploads/profile-image' : '/uploads/cover-image',
      { image: dataUrl },
    );
    onSaved(data.filename, crop.type);
    setCrop(null);
  }

  const cropNode = crop ? (
    <ControlPanelCropModal
      src={crop.src}
      pictureType={crop.type}
      onCancel={() => setCrop(null)}
      onCropped={(d) => void upload(d)}
    />
  ) : null;

  return { onFileChange, cropNode };
}

/**
 * Control-panel image cropper — exact port of #cropperModal in layouts/main.blade.php.
 * Opened when a profile/cover picture is chosen; aspectRatio 1 (profile) or 3 (cover),
 * viewMode 3, a 160px live preview, and a fixed 1095×1080 output canvas. Minimum source
 * size is 250×250, as the blade enforces.
 */
export function ControlPanelCropModal({
  src,
  pictureType,
  onCancel,
  onCropped,
}: {
  src: string;
  pictureType: 'profile' | 'cover';
  onCancel: () => void;
  onCropped: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const cropper = new Cropper(imgRef.current, {
      aspectRatio: pictureType === 'profile' ? 1 : 3,
      viewMode: 3,
      preview: '.preview',
    });
    cropperRef.current = cropper;
    return () => {
      cropper.destroy();
      cropperRef.current = null;
    };
  }, [pictureType]);

  function crop() {
    const canvas = cropperRef.current?.getCroppedCanvas({ width: 1095, height: 1080 });
    if (!canvas) return;
    onCropped(canvas.toDataURL('image/png'));
  }

  return (
    <div
      className="modal fade in"
      id="cropperModal"
      tabIndex={-1}
      role="dialog"
      style={{ zIndex: 9999999, display: 'block', position: 'fixed', inset: 0, overflowY: 'auto', background: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div className="modal-dialog modal-lg" role="document" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <button
              type="button"
              className="close"
              aria-label="Close"
              onClick={onCancel}
              style={{ position: 'absolute', right: 10, background: 'transparent', border: 0 }}
            >
              <span aria-hidden="true">×</span>
            </button>
            <h5 className="modal-title cropper-title" id="modalLabel">
              Recorta la imagen para subirla
            </h5>
            <p
              className="cropper-subtitle"
              style={{ color: '#666', fontFamily: 'consolas', fontSize: '0.7em', marginTop: 35 }}
            >
              Estamos en <i>Beta Phase</i>. Pronto estará disponible subir imágenes HD en tu cover
              o foto de perfil.
            </p>
          </div>
          <div className="modal-body">
            <div className="img-container">
              <div className="row cropper_row">
                <div className="col-md-8" style={{ padding: 5 }}>
                  <img ref={imgRef} src={src} id="sample_image" style={{ maxWidth: '100%' }} alt="" />
                </div>
                <div className="col-md-4">
                  <div
                    className="preview"
                    style={{ overflow: 'hidden', width: 160, height: 160, margin: 10, border: '1px solid #ddd' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary" id="crop" onClick={crop}>
              Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
