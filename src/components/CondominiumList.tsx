import { useState } from 'react';
import { Plus, Edit, Trash2, Building2, MapPin, FileText } from 'lucide-react';
import { Condominium } from '../types';

interface Props {
  condominiums: Condominium[];
  onSelect: (condo: Condominium) => void;
  onUpdate: () => void;
}

export default function CondominiumList({ condominiums, onSelect, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    nipc: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await window.electronAPI.run(
        'UPDATE condominiums SET name = ?, address = ?, nipc = ? WHERE id = ?',
        [formData.name, formData.address, formData.nipc, editingId]
      );
    } else {
      await window.electronAPI.run(
        'INSERT INTO condominiums (name, address, nipc) VALUES (?, ?, ?)',
        [formData.name, formData.address, formData.nipc]
      );
    }

    setFormData({ name: '', address: '', nipc: '' });
    setShowForm(false);
    setEditingId(null);
    onUpdate();
  };

  const handleEdit = (condo: Condominium) => {
    setFormData({
      name: condo.name,
      address: condo.address || '',
      nipc: condo.nipc || '',
    });
    setEditingId(condo.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja eliminar este condomínio?')) {
      await window.electronAPI.run('DELETE FROM condominiums WHERE id = ?', [id]);
      onUpdate();
    }
  };

  return (
    <div>
      <div className="page-hero">
        <h1>Bem-vindo de volta</h1>
        <p>Selecione um condomínio para começar ou crie um novo</p>
        {condominiums.length > 0 && (
          <span className="page-hero-meta">
            {condominiums.length === 1
              ? '1 condomínio em gestão'
              : `${condominiums.length} condomínios em gestão`}
          </span>
        )}
      </div>

      {showForm && (
        <div className="card form-card">
          <div className="card-header">
            <h3>{editingId ? 'Editar Condomínio' : 'Novo Condomínio'}</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nome *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do condomínio"
              />
            </div>
            <div className="form-group">
              <label>Morada</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, cidade"
              />
            </div>
            <div className="form-group">
              <label>NIPC</label>
              <input
                type="text"
                value={formData.nipc}
                onChange={(e) => setFormData({ ...formData, nipc: e.target.value })}
                placeholder="Número de identificação"
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({ name: '', address: '', nipc: '' });
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {condominiums.length === 0 && !showForm ? (
        <div className="empty-state">
          <Building2 size={64} className="empty-state-icon" />
          <h3>Nenhum condomínio registado</h3>
          <p>Comece criando o seu primeiro condomínio</p>
          <button
            className="primary-btn"
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData({ name: '', address: '', nipc: '' });
            }}
          >
            <Plus size={20} />
            Criar Primeiro Condomínio
          </button>
        </div>
      ) : (
        <>
          <div className="page-toolbar">
            <button
              className="primary-btn"
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                setFormData({ name: '', address: '', nipc: '' });
              }}
            >
              <Plus size={20} />
              Novo Condomínio
            </button>
          </div>

          <div className="condo-grid">
            {condominiums.map((condo) => (
              <div key={condo.id} className="condo-card" onClick={() => onSelect(condo)}>
                <div className="condo-card-icon">
                  <Building2 size={48} />
                </div>
                <div className="condo-card-content">
                  <h3 className="condo-card-title">{condo.name}</h3>
                  {condo.address && (
                    <div className="condo-card-detail">
                      <MapPin size={14} />
                      <span>{condo.address}</span>
                    </div>
                  )}
                  {condo.nipc && (
                    <div className="condo-card-detail">
                      <FileText size={14} />
                      <span>NIPC: {condo.nipc}</span>
                    </div>
                  )}
                </div>
                <div className="condo-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => handleEdit(condo)}
                    title="Editar"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => handleDelete(condo.id)}
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
