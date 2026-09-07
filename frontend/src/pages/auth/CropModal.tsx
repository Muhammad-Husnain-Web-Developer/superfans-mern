import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { api } from '../../api/client';

export type PictureType = 'profile' | 'cover';

interface CropModalProps {
  /** data URL of the picked image */
  imageSrc: string;
  pictureType: PictureType;
  onClose: () => void;
  /** called with the server filename after a successful crop+upload */
  onUploaded: (filename: string) => void;
}

/**
 * Pixel parity with the #modal cropper dialog in register_u.blade.php:
 * aspect 1 (profile) / 3 (cover), viewMode 3, 160px red-bordered live preview,
 * crop → canvas 1095×1080 → base64 → POST → { filename }.
 */
export function CropModal({ imageSrc, pictureType, onClose, onUploaded }: CropModalProps) {
  const { t: tUi } = useTranslation('ui');
  const imgRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const cropperRef = useRef<Cropper | null>(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const cropper = new Cropper(imgRef.current, {
      aspectRatio: pictureType === 'profile' ? 1 : 3,
      viewMode: 3,
      preview: previewRef.current ?? undefined,
    });
    cropperRef.current = cropper;
    return () => {
      cropper.destroy();
      cropperRef.current = null;
    };
  }, [imageSrc, pictureType]);

  function crop() {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 1095, height: 1080 });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const uploadUrl =
          pictureType === 'profile' ? '/uploads/profile-image' : '/uploads/cover-image';
        void api
          .post<{ filename: string }>(uploadUrl, { image: base64data })
          .then(({ data }) => onUploaded(data.filename))
          .catch(() => onClose());
      };
    });
  }

  return (
    <div className="crop-modal-backdrop">
      <div className="crop-modal-dialog">
        <div className="crop-modal-content">
          <div className="crop-modal-header">
            <button type="button" className="crop-modal-close" aria-label={tUi('close')} onClick={onClose}>
              <span aria-hidden="true">—</span>
            </button>
            <h5 className="crop-modal-title">{tUi('crop_image_title')}</h5>
            <p className="crop-modal-subtitle">
              {/* the <i> around "Beta Phase" is part of the line, so it is rendered */}
              <span dangerouslySetInnerHTML={{ __html: tUi('crop_beta_notice') }} />
            </p>
          </div>
          <div className="crop-modal-body">
            <div className="cropper_row">
              <div className="cropper-col-image">
                <img ref={imgRef} src={imageSrc} id="sample_image" alt="" />
              </div>
              <div className="cropper-col-preview">
                <div ref={previewRef} className="crop-preview" />
              </div>
            </div>
          </div>
          <div className="crop-modal-footer">
            <button type="button" className="crop-btn-cancel" onClick={onClose}>
              {tUi('cancel')}
            </button>
            <button type="button" className="crop-btn-crop" onClick={crop}>
              {tUi('crop')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
