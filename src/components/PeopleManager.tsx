import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Condominium, Person } from '../types';

interface Props {
  condominium: Condominium;
}

export default function PeopleManager({ condominium }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    nif: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    loadPeople();
  }, [condominium]);

  const loadPeople = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM people WHERE condominium_id = ? ORDER BY name',
      [condominium.id]
    );
    if (result.success) {
      setPeople(result.data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await window.electronAPI.run(
        'UPDATE people SET name = ?, email = ?, phone = ?, nif = ?, address = ?, notes = ? WHERE id = ?',
        [
          formData.name,
          formData.email || null,
          formData.phone || null,
          formData.nif || null,
          formData.address || null,
          formData.notes || null,
          editingId,
        ]
      );
    } else {
      await window.electronAPI.run(
        'INSERT INTO people (condominium_id, name, email, phone, nif, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          condominium.id,
          formData.name,
          formData.email || null,
          formData.phone || null,
          formData.nif || null,
          formData.address || null,
          formData.notes || null,
        ]
      );
    }

    setFormData({
      name: '',
      email: '',
      phone: '',
      nif: '',
      address: '',
      notes: '',
    });
    setShowForm(false);
    setEditingId(null);
    loadPeople();
  };

  const handleEdit = (person: Person) => {
    setFormData({
      name: person.name,
      email: person.email || '',
      phone: person.phone || '',
      nif: person.nif || '',
      address: person.address || '',
      notes: person.notes || '',
    });
    setEditingId(person.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (
      confirm(
        'Tem certeza que deseja eliminar esta pessoa? Isto também irá remover todas as relações com frações.'
      )
    ) {
      // Delete ownership relationships first
      await window.electronAPI.run('DELETE FROM unit_ownership WHERE person_id = ?', [id]);
      // Then delete the person
      await window.electronAPI.run('DELETE FROM people WHERE id = ?', [id]);
      loadPeople();
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Proprietários e Arrendatários</h3>
            <p className="section-subtitle">
              Total de pessoas: {people.length}
            </p>
          </div>
          <button
            className="primary-btn"
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                name: '',
                email: '',
                phone: '',
                nif: '',
                address: '',
                notes: '',
              });
            }}
          >
            <Plus size={20} />
            Nova Pessoa
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="section-stack">
            <div className="form-group">
              <label>Nome *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo..."
              />
            </div>
            <div className="form-group">
              <label>NIF</label>
              <input
                type="text"
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                placeholder="Número de Identificação Fiscal..."
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="exemplo@email.com"
              />
            </div>
            <div className="form-group">
              <label>Telefone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+351 912 345 678"
              />
            </div>
            <div className="form-group">
              <label>Morada</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, cidade..."
              />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Observações adicionais..."
              />
            </div>
            <div className="toolbar">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Atualizar' : 'Criar'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    name: '',
                    email: '',
                    phone: '',
                    nif: '',
                    address: '',
                    notes: '',
                  });
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>NIF</th>
              <th>Telefone</th>
              <th>Email</th>
              <th>Morada</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td className="table-value-strong">{person.name}</td>
                <td>{person.nif || '-'}</td>
                <td>{person.phone || '-'}</td>
                <td>{person.email || '-'}</td>
                <td className="table-col-notes">
                  <span className="table-note">{person.address || '-'}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-secondary btn-icon-sm"
                      onClick={() => handleEdit(person)}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon-sm"
                      onClick={() => handleDelete(person.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {people.length === 0 && !showForm && (
          <p className="section-empty">Nenhuma pessoa registada.</p>
        )}
      </div>
    </div>
  );
}
