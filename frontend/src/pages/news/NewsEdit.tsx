import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import type { NewsItem } from './News';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Edit News — port of influencer/newsedit.blade.php. */
export function NewsEdit() {
  useStandalonePageStyles([BOOTSTRAP4_CDN]);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [file, setFile] = useState<File | null>(null);
  const { t: tUi } = useTranslation('ui');

  useEffect(() => {
    document.title = 'Superfans | Edit News';
    api.get<{ data: NewsItem }>(`/news/${id}`).then(({ data }) => {
      const n = data.data;
      setItem(n);
      setTitle(n.title);
      setContent(n.content);
      setButtonText(n.buttonText ?? '');
      setButtonLink(n.buttonLink ?? '');
      setStatus(n.status);
    });
  }, [id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const image = file ? await fileToDataUrl(file) : undefined;
    await api.patch(`/news/${id}`, { title, content, status, buttonText, buttonLink, image });
    navigate('/influencer/news');
  }

  if (!item) return null;

  return (
    <div className="container mt-4">
      <h2>{tUi('news_edit')}</h2>
      <form onSubmit={submit}>
        <div className="form-group">
          <label>{tUi('title_label')}</label>
          <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>{tUi('content_label')}</label>
          <textarea className="form-control" rows={4} value={content} onChange={(e) => setContent(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>{tUi('image_optional')}</label>
          <br />
          {item.image && <img src={assetImage(item.image)} width={100} className="mb-2" alt="" />}
          <input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="form-group">
          <label>{tUi('optional_button_text')}</label>
          <input type="text" className="form-control" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{tUi('optional_button_link')}</label>
          <input type="url" className="form-control" value={buttonLink} onChange={(e) => setButtonLink(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{tUi('status_label')}</label>
          <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}>
            <option value="active">{tUi('active')}</option>
            <option value="paused">{tUi('paused')}</option>
          </select>
        </div>
        <button type="submit" className="btn btn-success">
          {tUi('news_update')}
        </button>
        <a href="/influencer/news" className="btn btn-secondary ml-2">
          {tUi('back')}
        </a>
      </form>
    </div>
  );
}
