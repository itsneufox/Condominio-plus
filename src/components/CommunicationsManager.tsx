import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, SendHorizonal } from 'lucide-react';
import { Communication, Condominium } from '../types';

interface Props {
  condominium: Condominium;
}

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'owners', label: 'Proprietários' },
  { value: 'residents', label: 'Residentes' },
  { value: 'proxies', label: 'Procuradores' },
];

const CHANNEL_OPTIONS = [
  { value: 'noticeboard', label: 'Aviso / Quadro' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'phone', label: 'Telefone' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'sent', label: 'Enviado' },
];

export default function CommunicationsManager({ condominium }: Props) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    audience: 'all',
    channel: 'noticeboard',
    status: 'draft',
    sent_date: '',
    message: '',
  });

  useEffect(() => {
    loadCommunications();
  }, [condominium]);

  const loadCommunications = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM communications WHERE condominium_id = ? ORDER BY created_at DESC',
      [condominium.id]
    );
    if (result.success) {
      setCommunications(result.data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await window.electronAPI.run(
        `UPDATE communications
         SET title = ?, audience = ?, channel = ?, status = ?, sent_date = ?, message = ?
         WHERE id = ?`,
        [
          formData.title,
          formData.audience,
          formData.channel,
          formData.status,
          formData.sent_date || null,
          formData.message,
          editingId,
        ]
      );
    } else {
      await window.electronAPI.run(
        `INSERT INTO communications (condominium_id, title, audience, channel, status, sent_date, message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          condominium.id,
          formData.title,
          formData.audience,
          formData.channel,
          formData.status,
          formData.sent_date || null,
          formData.message,
        ]
      );
    }

    resetForm();
    loadCommunications();
  };

  const handleEdit = (communication: Communication) => {
    setFormData({
      title: communication.title,
      audience: communication.audience,
      channel: communication.channel,
      status: communication.status,
      sent_date: communication.sent_date || '',
      message: communication.message,
    });
    setEditingId(communication.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja eliminar este aviso/comunicação?')) {
      await window.electronAPI.run('DELETE FROM communications WHERE id = ?', [id]);
      loadCommunications();
    }
  };

  const handleMarkSent = async (id: number) => {
    await window.electronAPI.run(
      'UPDATE communications SET status = ?, sent_date = ? WHERE id = ?',
      ['sent', new Date().toISOString().split('T')[0], id]
    );
    loadCommunications();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      audience: 'all',
      channel: 'noticeboard',
      status: 'draft',
      sent_date: '',
      message: '',
    });
    setShowForm(false);
    setEditingId(null);
  };

  const translate = (value: string, list: { value: string; label: string }[]) => {
    return list.find((item) => item.value === value)?.label || value;
  };

  const formatDateTime = (value: string) => {
    return new Date(value).toLocaleString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusClassMap: Record<string, string> = {
    draft: 'badge badge-warning',
    scheduled: 'badge badge-info',
    sent: 'badge badge-success',
  };

  const renderStatusBadge = (status: string) => (
    <span className={statusClassMap[status] || 'badge badge-info'}>
      {translate(status, STATUS_OPTIONS)}
    </span>
  );

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Histórico de Avisos</h3>
            <p className="section-subtitle">
              Registe comunicações enviadas aos condóminos, incluindo instruções, avisos de obras ou cobranças.
            </p>
          </div>
          <button
            className="primary-btn"
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) {
                resetForm();
                setShowForm(true);
              }
            }}
          >
            <Plus size={20} />
            Nova Comunicação
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="section-stack">
            <div className="form-group">
              <label>Título *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Público Alvo *</label>
              <select
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              >
                {AUDIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Canal *</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Estado *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Data de envio</label>
              <input
                type="date"
                value={formData.sent_date}
                onChange={(e) => setFormData({ ...formData, sent_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Mensagem *</label>
              <textarea
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                placeholder="Corpo da comunicação, instruções, pedidos, avisos..."
              />
            </div>
            <div className="toolbar">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Atualizar' : 'Criar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Público</th>
              <th>Canal</th>
              <th>Estado</th>
              <th>Enviada em</th>
              <th>Mensagem</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {communications.map((communication) => (
              <tr key={communication.id}>
                <td className="table-value-strong">{communication.title}</td>
                <td>{translate(communication.audience, AUDIENCE_OPTIONS)}</td>
                <td>{translate(communication.channel, CHANNEL_OPTIONS)}</td>
                <td>{renderStatusBadge(communication.status)}</td>
                <td>
                  {communication.sent_date
                    ? formatDateTime(`${communication.sent_date}T12:00:00`)
                    : '—'}
                </td>
                <td className="table-col-notes">
                  <span className="table-note">{communication.message}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-secondary btn-icon-sm" onClick={() => handleEdit(communication)}>
                      <Edit size={16} />
                    </button>
                    <button
                      className="btn btn-success btn-icon-sm"
                      onClick={() => handleMarkSent(communication.id)}
                      title="Marcar como enviada"
                    >
                      <SendHorizonal size={16} />
                    </button>
                    <button className="btn btn-danger btn-icon-sm" onClick={() => handleDelete(communication.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="text-xs text-muted mt-xs">
                    Registada em {formatDateTime(communication.created_at)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {communications.length === 0 && !showForm && (
          <p className="section-empty">Nenhuma comunicação registada.</p>
        )}
      </div>
    </div>
  );
}
