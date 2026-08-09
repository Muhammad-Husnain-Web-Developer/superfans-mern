import { useEffect, useState, type FormEvent } from 'react';
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
    if (!window.confirm('Delete this news?')) return;
    await api.delete(`/news/${id}`);
    setFlash('News deleted');
    load();
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">News Management</h2>

      {flash && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {flash}
          <button type="button" className="close" onClick={() => setFlash(null)}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      <button className="btn btn-primary mb-3" onClick={() => setShowForm((v) => !v)}>
        Add New News
      </button>

      {showForm && (
        <div className="card p-3 mb-4">
          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="content">Content</label>
              <textarea className="form-control" rows={4} value={content} onChange={(e) => setContent(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="image">Optional Image</label>
              <input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="form-group">
              <label htmlFor="button_text">Optional Button Text</label>
              <input type="text" className="form-control" placeholder="e.g., Read More" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="button_link">Optional Button Link</label>
              <input type="url" className="form-control" placeholder="https://..." value={buttonLink} onChange={(e) => setButtonLink(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}>
                <option value="active">Active</option>
                <option value="paused">Inactive</option>
              </select>
            </div>
            <button type="submit" className="btn btn-success">
              Post News
            </button>
          </form>
        </div>
      )}

      <table className="table table-bordered table-striped" id="newsTable">
        <thead className="thead-dark">
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Content</th>
            <th>Image</th>
            <th>Button</th>
            <th>Status</th>
            <th>Actions</th>
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
                  <img src={assetImage(item.image)} width={80} alt="News Image" />
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
                  Edit
                </button>{' '}
                <button className="btn btn-sm btn-danger" onClick={() => void remove(item.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
