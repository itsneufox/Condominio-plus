import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, CalendarDays } from 'lucide-react';
import { Condominium, Meeting } from '../types';

interface Props {
  condominium: Condominium;
}

export default function MeetingsManager({ condominium }: Props) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    meeting_date: new Date().toISOString().split('T')[0],
    location: '',
    agenda: '',
    minutes: '',
  });

  useEffect(() => {
    loadMeetings();
  }, [condominium]);

  const loadMeetings = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM meetings WHERE condominium_id = ? ORDER BY meeting_date DESC',
      [condominium.id]
    );
    if (result.success) {
      setMeetings(result.data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await window.electronAPI.run(
        `UPDATE meetings
         SET title = ?, meeting_date = ?, location = ?, agenda = ?, minutes = ?
         WHERE id = ?`,
        [
          formData.title,
          formData.meeting_date,
          formData.location || null,
          formData.agenda || null,
          formData.minutes || null,
          editingId,
        ]
      );
    } else {
      await window.electronAPI.run(
        `INSERT INTO meetings (condominium_id, title, meeting_date, location, agenda, minutes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          condominium.id,
          formData.title,
          formData.meeting_date,
          formData.location || null,
          formData.agenda || null,
          formData.minutes || null,
        ]
      );
    }

    setFormData({
      title: '',
      meeting_date: new Date().toISOString().split('T')[0],
      location: '',
      agenda: '',
      minutes: '',
    });
    setShowForm(false);
    setEditingId(null);
    loadMeetings();
  };

  const handleEdit = (meeting: Meeting) => {
    setFormData({
      title: meeting.title,
      meeting_date: meeting.meeting_date,
      location: meeting.location || '',
      agenda: meeting.agenda || '',
      minutes: meeting.minutes || '',
    });
    setEditingId(meeting.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja eliminar esta reunião?')) {
      await window.electronAPI.run('DELETE FROM meetings WHERE id = ?', [id]);
      loadMeetings();
    }
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Assembleias e Reuniões</h3>
            <p className="section-subtitle">
              Registe convocatórias, agendas e atas para manter o histórico atualizado.
            </p>
          </div>
          <button
            className="primary-btn"
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                title: '',
                meeting_date: new Date().toISOString().split('T')[0],
                location: '',
                agenda: '',
                minutes: '',
              });
            }}
          >
            <Plus size={20} />
            Nova Reunião
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
                placeholder="Assembleia Geral Ordinária, Reunião Extraordinária..."
              />
            </div>
            <div className="form-group">
              <label>Data *</label>
              <input
                type="date"
                required
                value={formData.meeting_date}
                onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Local</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Sala de reuniões, ginásio, plataforma online..."
              />
            </div>
            <div className="form-group">
              <label>Agenda</label>
              <textarea
                value={formData.agenda}
                onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                rows={3}
                placeholder="Pontos a discutir, ordem de trabalhos..."
              />
            </div>
            <div className="form-group">
              <label>Atas / Notas</label>
              <textarea
                value={formData.minutes}
                onChange={(e) => setFormData({ ...formData, minutes: e.target.value })}
                rows={4}
                placeholder="Decisões tomadas, deliberações, votações..."
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
              <th>Data</th>
              <th>Título</th>
              <th>Local</th>
              <th>Agenda</th>
              <th>Atas / Notas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((meeting) => (
              <tr key={meeting.id}>
                <td>
                  <div className="list-inline">
                    <CalendarDays size={18} />
                    {formatDate(meeting.meeting_date)}
                  </div>
                </td>
                <td className="table-value-strong">{meeting.title}</td>
                <td>{meeting.location || '-'}</td>
                <td className="table-col-notes">
                  <span className="table-note">{meeting.agenda || '-'}</span>
                </td>
                <td className="table-col-notes">
                  <span className="table-note">{meeting.minutes || '-'}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-secondary btn-icon-sm"
                      onClick={() => handleEdit(meeting)}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon-sm"
                      onClick={() => handleDelete(meeting.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {meetings.length === 0 && !showForm && (
          <p className="section-empty">Nenhuma reunião registada.</p>
        )}
      </div>
    </div>
  );
}
