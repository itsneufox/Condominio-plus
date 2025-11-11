import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Building2 } from 'lucide-react';
import { Condominium, Supplier } from '../types';

interface Props {
  condominium: Condominium;
}

export default function SupplierManager({ condominium }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
    loadSuppliers();
  }, [condominium]);

  const loadSuppliers = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM suppliers WHERE condominium_id = ? ORDER BY name',
      [condominium.id]
    );
    if (result.success) {
      setSuppliers(result.data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await window.electronAPI.run(
        `UPDATE suppliers
         SET name = ?, email = ?, phone = ?, nif = ?, address = ?, notes = ?
         WHERE id = ?`,
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
        `INSERT INTO suppliers (condominium_id, name, email, phone, nif, address, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
    loadSuppliers();
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      nif: supplier.nif || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setEditingId(supplier.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (
      confirm(
        'Tem certeza que deseja eliminar este fornecedor? Todos os movimentos ou tarefas associados terão o fornecedor removido.'
      )
    ) {
      await window.electronAPI.run('UPDATE transactions SET supplier_id = NULL WHERE supplier_id = ?', [id]);
      await window.electronAPI.run('UPDATE maintenance_tasks SET supplier_id = NULL WHERE supplier_id = ?', [id]);
      await window.electronAPI.run('DELETE FROM suppliers WHERE id = ?', [id]);
      loadSuppliers();
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Prestadores de Serviços</h3>
            <p className="section-subtitle">
              Total de fornecedores registados: {suppliers.length}
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
            Novo Fornecedor
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
                placeholder="Empresa ou prestador..."
              />
            </div>
            <div className="form-group">
              <label>NIF</label>
              <input
                type="text"
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Telefone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Morada</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Informações sobre contratos, escalas, horário de contacto..."
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
              <th>Nome</th>
              <th>Contacto</th>
              <th>NIF</th>
              <th>Morada</th>
              <th>Notas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td>
                  <div className="list-inline">
                    <Building2 size={18} />
                    <div>
                      <div className="table-value-strong">{supplier.name}</div>
                      <div className="table-subtext">
                        Registado em {new Date(supplier.created_at).toLocaleDateString('pt-PT')}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="grid-auto-xs">
                    {supplier.email && <span className="table-note">{supplier.email}</span>}
                    {supplier.phone && <span className="table-note">{supplier.phone}</span>}
                  </div>
                </td>
                <td>{supplier.nif || '-'}</td>
                <td>{supplier.address || '-'}</td>
                <td className="table-col-notes">
                  <span className="table-note">{supplier.notes || '-'}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-secondary btn-icon-sm"
                      onClick={() => handleEdit(supplier)}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon-sm"
                      onClick={() => handleDelete(supplier.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {suppliers.length === 0 && !showForm && (
          <p className="section-empty">Nenhum fornecedor registado.</p>
        )}
      </div>
    </div>
  );
}
