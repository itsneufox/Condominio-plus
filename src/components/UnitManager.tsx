import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { Condominium, Unit, Person } from '../types';

interface Props {
  condominium: Condominium;
}

interface UnitWithOwnership extends Unit {
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  owner_type?: 'owner' | 'renter' | 'usufructuary';
  renter_name?: string;
  renter_email?: string;
  renter_phone?: string;
  usufructuary_name?: string;
  usufructuary_email?: string;
  usufructuary_phone?: string;
  proxy_name?: string;
  proxy_email?: string;
  proxy_phone?: string;
}

export default function UnitManager({ condominium }: Props) {
  const [units, setUnits] = useState<UnitWithOwnership[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showOwnershipModal, setShowOwnershipModal] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    unit_number: '',
    unit_type: 'apartment' as 'apartment' | 'store' | 'garage' | 'other',
    floor: '',
    permilagem: '1.0',
    notes: '',
  });

  const [ownershipFormData, setOwnershipFormData] = useState({
    person_id: '',
    relationship_type: 'owner' as 'owner' | 'renter' | 'usufructuary' | 'proxy',
    start_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadUnits();
    loadPeople();
  }, [condominium]);

  const loadUnits = async () => {
    const result = await window.electronAPI.query(
      `SELECT u.*,
              owner.name as owner_name,
              owner.email as owner_email,
              owner.phone as owner_phone,
              renter.name as renter_name,
              renter.email as renter_email,
              renter.phone as renter_phone,
              usuf.name as usufructuary_name,
              usuf.email as usufructuary_email,
              usuf.phone as usufructuary_phone,
              proxy_person.name as proxy_name,
              proxy_person.email as proxy_email,
              proxy_person.phone as proxy_phone
       FROM units u
       LEFT JOIN unit_ownership owner_rel ON u.id = owner_rel.unit_id
         AND owner_rel.is_active = 1
         AND owner_rel.relationship_type = 'owner'
       LEFT JOIN people owner ON owner_rel.person_id = owner.id
       LEFT JOIN unit_ownership renter_rel ON u.id = renter_rel.unit_id
         AND renter_rel.is_active = 1
         AND renter_rel.relationship_type = 'renter'
       LEFT JOIN people renter ON renter_rel.person_id = renter.id
       LEFT JOIN unit_ownership usuf_rel ON u.id = usuf_rel.unit_id
         AND usuf_rel.is_active = 1
         AND usuf_rel.relationship_type = 'usufructuary'
       LEFT JOIN people usuf ON usuf_rel.person_id = usuf.id
       LEFT JOIN unit_ownership proxy_rel ON u.id = proxy_rel.unit_id
         AND proxy_rel.is_active = 1
         AND proxy_rel.relationship_type = 'proxy'
       LEFT JOIN people proxy_person ON proxy_rel.person_id = proxy_person.id
       WHERE u.condominium_id = ?
       ORDER BY u.unit_number`,
      [condominium.id]
    );
    if (result.success) {
      setUnits(result.data || []);
    }
  };

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
        'UPDATE units SET unit_number = ?, unit_type = ?, floor = ?, permilagem = ?, notes = ? WHERE id = ?',
        [
          formData.unit_number,
          formData.unit_type,
          formData.floor || null,
          parseFloat(formData.permilagem),
          formData.notes || null,
          editingId,
        ]
      );
    } else {
      await window.electronAPI.run(
        'INSERT INTO units (condominium_id, unit_number, unit_type, floor, permilagem, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [
          condominium.id,
          formData.unit_number,
          formData.unit_type,
          formData.floor || null,
          parseFloat(formData.permilagem),
          formData.notes || null,
        ]
      );
    }

    setFormData({
      unit_number: '',
      unit_type: 'apartment',
      floor: '',
      permilagem: '1.0',
      notes: '',
    });
    setShowForm(false);
    setEditingId(null);
    loadUnits();
  };

  const handleEdit = (unit: UnitWithOwnership) => {
    setFormData({
      unit_number: unit.unit_number,
      unit_type: unit.unit_type,
      floor: unit.floor || '',
      permilagem: unit.permilagem.toString(),
      notes: unit.notes || '',
    });
    setEditingId(unit.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja eliminar esta fração?')) {
      await window.electronAPI.run('DELETE FROM units WHERE id = ?', [id]);
      loadUnits();
    }
  };

  const handleManageOwnership = (unitId: number) => {
    setSelectedUnitId(unitId);
    setOwnershipFormData({
      person_id: '',
      relationship_type: 'owner',
      start_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowOwnershipModal(true);
  };

  const handleRemoveOwnership = async (
    relationshipType: 'owner' | 'renter' | 'usufructuary' | 'proxy'
  ) => {
    if (!selectedUnitId) return;

    const confirmationMessage =
      relationshipType === 'owner'
        ? 'Tem certeza que deseja remover o proprietário atual?'
        : relationshipType === 'renter'
          ? 'Tem certeza que deseja remover o arrendatário atual?'
          : relationshipType === 'usufructuary'
            ? 'Tem certeza que deseja remover o usufrutuário atual?'
            : 'Tem certeza que deseja remover o procurador atual?';

    if (!confirm(confirmationMessage)) {
      return;
    }

    const endDate = new Date().toISOString().split('T')[0];

    await window.electronAPI.run(
      `UPDATE unit_ownership
       SET is_active = 0, end_date = ?
       WHERE unit_id = ?
         AND relationship_type = ?
         AND is_active = 1`,
      [endDate, selectedUnitId, relationshipType]
    );

    setShowOwnershipModal(false);
    setSelectedUnitId(null);
    loadUnits();
  };

  const handleOwnershipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) return;

    await window.electronAPI.run(
      `UPDATE unit_ownership
       SET is_active = 0, end_date = ?
       WHERE unit_id = ?
         AND relationship_type = ?
         AND is_active = 1`,
      [ownershipFormData.start_date, selectedUnitId, ownershipFormData.relationship_type]
    );

    await window.electronAPI.run(
      `INSERT INTO unit_ownership (unit_id, person_id, relationship_type, start_date, is_active, notes)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [
        selectedUnitId,
        parseInt(ownershipFormData.person_id),
        ownershipFormData.relationship_type,
        ownershipFormData.start_date,
        ownershipFormData.notes || null,
      ]
    );

    setShowOwnershipModal(false);
    setSelectedUnitId(null);
    loadUnits();
  };

  const totalPermilagens = units.reduce((sum, unit) => sum + unit.permilagem, 0);
  const selectedUnit = selectedUnitId ? units.find((unit) => unit.id === selectedUnitId) : null;

  const getUnitTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      apartment: 'Apartamento',
      store: 'Loja',
      garage: 'Garagem',
      other: 'Outro',
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Frações do Condomínio</h3>
            <p className="section-subtitle">
              Total de permilagens: {totalPermilagens.toFixed(3)}
            </p>
          </div>
          <button
            className="primary-btn"
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                unit_number: '',
                unit_type: 'apartment',
                floor: '',
                permilagem: '1.0',
                notes: '',
              });
            }}
          >
            <Plus size={20} />
            Nova Fração
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="section-stack">
            <div className="form-group">
              <label>Número da Fração *</label>
              <input
                type="text"
                required
                value={formData.unit_number}
                onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                placeholder="ex: 1º A, 2º B, Loja 1..."
              />
            </div>
            <div className="form-group">
              <label>Tipo de Fração *</label>
              <select
                required
                value={formData.unit_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    unit_type: e.target.value as 'apartment' | 'store' | 'garage' | 'other',
                  })
                }
              >
                <option value="apartment">Apartamento</option>
                <option value="store">Loja</option>
                <option value="garage">Garagem</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label>Andar</label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                placeholder="ex: 1, 2, R/C..."
              />
            </div>
            <div className="form-group">
              <label>Permilagem *</label>
              <input
                type="number"
                step="0.001"
                required
                value={formData.permilagem}
                onChange={(e) => setFormData({ ...formData, permilagem: e.target.value })}
              />
              <small className="section-hint mt-xs">
                A permilagem é usada para calcular a quota de cada fração nas despesas comuns
              </small>
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
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
                    unit_number: '',
                    unit_type: 'apartment',
                    floor: '',
                    permilagem: '1.0',
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
              <th>Fração</th>
              <th>Tipo</th>
              <th>Andar</th>
              <th>Proprietário</th>
              <th>Arrendatário</th>
              <th>Usufrutuário</th>
              <th>Procurador</th>
              <th>Permilagem</th>
              <th>% Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id}>
                <td className="table-value-strong">{unit.unit_number}</td>
                <td>{getUnitTypeLabel(unit.unit_type)}</td>
                <td>{unit.floor || '-'}</td>
                <td>
                  {unit.owner_name ? (
                    <div className="stack-sm tight">
                      <div>{unit.owner_name}</div>
                      {unit.owner_phone && <small className="text-sm text-muted">{unit.owner_phone}</small>}
                    </div>
                  ) : (
                    <span className="text-sm text-muted">Sem proprietário</span>
                  )}
                </td>
                <td>
                  {unit.renter_name ? (
                    <div className="stack-sm tight">
                      <div>{unit.renter_name}</div>
                      {unit.renter_phone && <small className="text-sm text-muted">{unit.renter_phone}</small>}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {unit.usufructuary_name ? (
                    <div className="stack-sm tight">
                      <div>{unit.usufructuary_name}</div>
                      {unit.usufructuary_phone && <small className="text-sm text-muted">{unit.usufructuary_phone}</small>}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {unit.proxy_name ? (
                    <div className="stack-sm tight">
                      <div>{unit.proxy_name}</div>
                      {unit.proxy_phone && <small className="text-sm text-muted">{unit.proxy_phone}</small>}
                    </div>
                  ) : (
                    <span className="text-sm text-muted">Sem procurador</span>
                  )}
                </td>
                <td>{unit.permilagem.toFixed(3)}</td>
                <td>
                  {totalPermilagens > 0
                    ? ((unit.permilagem / totalPermilagens) * 100).toFixed(2)
                    : 0}
                  %
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-secondary btn-icon-sm"
                      onClick={() => handleManageOwnership(unit.id)}
                      title="Gerir Pessoas"
                    >
                      <Users size={16} />
                    </button>
                    <button className="btn btn-secondary btn-icon-sm" onClick={() => handleEdit(unit)}>
                      <Edit size={16} />
                    </button>
                    <button className="btn btn-danger btn-icon-sm" onClick={() => handleDelete(unit.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {units.length > 0 && (
              <tr className="table-subheader">
                <td colSpan={7}>Total</td>
                <td>{totalPermilagens.toFixed(3)}</td>
                <td>100%</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>

        {units.length === 0 && !showForm && (
          <p className="section-empty">Nenhuma fração registada.</p>
        )}
      </div>

      {/* Ownership Management Modal */}
      {showOwnershipModal && (
        <div className="modal-backdrop" onClick={() => setShowOwnershipModal(false)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3>Atribuir Pessoa à Fração</h3>
            </div>

            {people.length === 0 ? (
              <div className="modal-content section-hint center">
                <p className="section-hint">
                  Não há pessoas registadas neste condomínio.
                </p>
                <p className="section-hint text-sm">
                  Por favor, registe pessoas primeiro na secção "Pessoas" antes de atribuir proprietários ou arrendatários.
                </p>
                <button className="btn btn-secondary mt-sm" onClick={() => setShowOwnershipModal(false)}>
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleOwnershipSubmit} className="modal-content">
                <div className="form-group">
                  <label>Pessoa *</label>
                  <select
                    required
                    value={ownershipFormData.person_id}
                    onChange={(e) =>
                      setOwnershipFormData({ ...ownershipFormData, person_id: e.target.value })
                    }
                  >
                    <option value="">Selecione uma pessoa...</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} {person.nif ? `(NIF: ${person.nif})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tipo de Relação *</label>
                  <select
                    required
                    value={ownershipFormData.relationship_type}
                    onChange={(e) =>
                      setOwnershipFormData({
                        ...ownershipFormData,
                        relationship_type: e.target.value as
                          | 'owner'
                          | 'renter'
                          | 'usufructuary'
                          | 'proxy',
                      })
                    }
                  >
                    <option value="owner">Proprietário</option>
                    <option value="renter">Arrendatário</option>
                    <option value="usufructuary">Usufrutuário</option>
                    <option value="proxy">Procurador</option>
                  </select>
                </div>

                {selectedUnit && (
                  <div className="surface-muted stack-sm">
                    {ownershipFormData.relationship_type === 'owner' ? (
                      selectedUnit.owner_name ? (
                        <div>
                          <strong>Proprietário atual:</strong> {selectedUnit.owner_name}
                          <div className="mt-sm">
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleRemoveOwnership('owner')}
                            >
                              Remover proprietário
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted">
                          Esta fração não tem proprietário ativo.
                        </span>
                      )
                    ) : ownershipFormData.relationship_type === 'renter' ? (
                      selectedUnit.renter_name ? (
                        <div>
                          <strong>Arrendatário atual:</strong> {selectedUnit.renter_name}
                          <div className="mt-sm">
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleRemoveOwnership('renter')}
                            >
                              Remover arrendatário
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted">
                          Esta fração não tem arrendatário ativo.
                        </span>
                      )
                    ) : ownershipFormData.relationship_type === 'usufructuary' ? (
                      selectedUnit.usufructuary_name ? (
                        <div>
                          <strong>Usufrutuário atual:</strong> {selectedUnit.usufructuary_name}
                          <div className="mt-sm">
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleRemoveOwnership('usufructuary')}
                            >
                              Remover usufrutuário
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted">
                          Esta fração não tem usufrutuário ativo.
                        </span>
                      )
                    ) : ownershipFormData.relationship_type === 'proxy' ? (
                      selectedUnit.proxy_name ? (
                        <div>
                          <strong>Procurador atual:</strong> {selectedUnit.proxy_name}
                          <div className="mt-sm">
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleRemoveOwnership('proxy')}
                            >
                              Remover procurador
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted">
                          Esta fração não tem procurador ativo.
                        </span>
                      )
                    ) : null}
                  </div>
                )}

                <div className="form-group">
                  <label>Data de Início *</label>
                  <input
                    type="date"
                    required
                    value={ownershipFormData.start_date}
                    onChange={(e) =>
                      setOwnershipFormData({ ...ownershipFormData, start_date: e.target.value })
                    }
                  />
                  <small className="section-hint mt-xs">
                    Se esta pessoa está a substituir outra, esta data será usada como data de fim da relação anterior
                  </small>
                </div>

                <div className="form-group">
                  <label>Notas</label>
                  <textarea
                    value={ownershipFormData.notes}
                    onChange={(e) =>
                      setOwnershipFormData({ ...ownershipFormData, notes: e.target.value })
                    }
                    rows={3}
                    placeholder="Informações sobre a compra, venda, ou arrendamento..."
                  />
                </div>

                <div className="toolbar">
                  <button type="submit" className="btn btn-primary">
                    Atribuir
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowOwnershipModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
