import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  image: string | null;
  status: 'active' | 'paused';
  buttonText: string | null;
  buttonLink: string | null;
  createdAt: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** News management — port of influencer/news.blade.php (a standalone Bootstrap 4 page:
 *  a toggleable "Add News" form above a table of all news with edit/delete). */
export function News() {
  useStandalonePageStyles([
    BOOTSTRAP4_CDN,
    'https://cdn.datatables.net/1.13.1/css/dataTables.bootstrap4.min.css',
  ]);
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const { t: tUi } = useTranslation('ui');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [file, setFile] = useState<File | null>(null);

  function load() {
    api.get<{ data: NewsItem[] }>('/news').then(({ data }) => setNews(data.data)).catch(() => setNews([]));
  }
  useEffect(() => {
    document.title = 'Superfans | News Management';
    load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const image = file ? await fileToDataUrl(file) : undefined;
    await api.post('/news', { title, content, status, buttonText, buttonLink, image });
    setFlash('News added');
    setTitle('');
    setContent('');
    setButtonText('');
    setButtonLink('');
    setStatus('active');
    setFile(null);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!window.confirm(tUi('news_delete_confirm'))) return;
    await api.delete(`/news/${id}`);
    setFlash('News deleted');
    load();
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">{tUi('news_management')}</h2>

      {flash && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {flash}
          <button type="button" className="close" onClick={() => setFlash(null)}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      <button className="btn btn-primary mb-3" onClick={() => setShowForm((v) => !v)}>
        {tUi('news_add')}
      </button>

      {showForm && (
        <div className="card p-3 mb-4">
          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="title">{tUi('title_label')}</label>
              <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="content">{tUi('content_label')}</label>
              <textarea className="form-control" rows={4} value={content} onChange={(e) => setContent(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="image">{tUi('optional_image')}</label>
              <input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="form-group">
              <label htmlFor="button_text">{tUi('optional_button_text')}</label>
              <input type="text" className="form-control" placeholder={tUi('read_more_example')} value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="button_link">{tUi('optional_button_link')}</label>
              <input type="url" className="form-control" placeholder="https://..." value={buttonLink} onChange={(e) => setButtonLink(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="status">{tUi('status_label')}</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}>
                <option value="active">{tUi('active')}</option>
                <option value="paused">{tUi('inactive')}</option>
              </select>
            </div>
            <button type="submit" className="btn btn-success">
              {tUi('news_post')}
            </button>
          </form>
        </div>
      )}

      <table className="table table-bordered table-striped" id="newsTable">
        <thead className="thead-dark">
          <tr>
            <th>ID</th>
            <th>{tUi('title_label')}</th>
            <th>{tUi('content_label')}</th>
            <th>{tUi('image_label')}</th>
            <th>{tUi('button_label')}</th>
            <th>{tUi('status_label')}</th>
            <th>{tUi('actions_label')}</th>
          </tr>
        </thead>
        <tbody>
          {news.map((item, i) => (
            <tr key={item.id}>
              <td>{i + 1}</td>
              <td>{item.title}</td>
              <td>{item.content.length > 100 ? `${item.content.slice(0, 100)}...` : item.content}</td>
              <td>
                {item.image ? (
                  <img src={assetImage(item.image)} width={80} alt={tUi('alt_news_image')} />
                ) : (
                  <span className="text-muted">N/A</span>
                )}
              </td>
              <td>
                {item.buttonText && item.buttonLink ? (
                  <a href={item.buttonLink} target="_blank" rel="noreferrer" className="btn btn-info btn-sm">
                    {item.buttonText}
                  </a>
                ) : (
                  <span className="text-muted">N/A</span>
                )}
              </td>
              <td>
                <span className={`badge badge-${item.status === 'active' ? 'success' : 'secondary'}`}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
              </td>
              <td>
                <button className="btn btn-sm btn-warning" onClick={() => navigate(`/influencer/news/${item.id}/edit`)}>
                  {tUi('edit')}
                </button>{' '}
                <button className="btn btn-sm btn-danger" onClick={() => void remove(item.id)}>
                  {tUi('delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
