import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Wrench, PlayCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Condominium, MaintenanceTask, Supplier } from '../types';

interface Props {
  condominium: Condominium;
}

interface UnitOption {
  id: number;
  unit_number: string;
}

type TaskFilter = 'all' | 'pending' | 'in_progress' | 'completed';

export default function MaintenanceManager({ condominium }: Props) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    unit_id: '',
    supplier_id: '',
    priority: 'medium',
    reported_date: new Date().toISOString().split('T')[0],
    due_date: '',
    estimated_cost: '',
    notes: '',
  });

  useEffect(() => {
    loadUnits();
    loadSuppliers();
  }, [condominium]);

  useEffect(() => {
    loadTasks();
  }, [condominium, filter]);

  const loadUnits = async () => {
    const result = await window.electronAPI.query(
      'SELECT id, unit_number FROM units WHERE condominium_id = ? ORDER BY unit_number',
      [condominium.id]
    );
    if (result.success) {
      setUnits(result.data || []);
    }
  };

  const loadSuppliers = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM suppliers WHERE condominium_id = ? ORDER BY name',
      [condominium.id]
    );
    if (result.success) {
      setSuppliers(result.data || []);
    }
  };

  const loadTasks = async () => {
    let sql = `
      SELECT mt.*,
             u.unit_number,
             s.name as supplier_name
      FROM maintenance_tasks mt
      LEFT JOIN units u ON mt.unit_id = u.id
      LEFT JOIN suppliers s ON mt.supplier_id = s.id
      WHERE mt.condominium_id = ?
    `;
    const params: any[] = [condominium.id];

    if (filter !== 'all') {
      sql += ' AND mt.status = ?';
      params.push(filter);
    }

    sql += `
      ORDER BY
        CASE mt.status
          WHEN 'pending' THEN 0
          WHEN 'in_progress' THEN 1
          ELSE 2
        END,
        COALESCE(mt.due_date, mt.reported_date) ASC
    `;

    const result = await window.electronAPI.query(sql, params);
    if (result.success) {
      setTasks(result.data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await window.electronAPI.run(
      `INSERT INTO maintenance_tasks (
        condominium_id, unit_id, supplier_id, title, description, status, priority,
        reported_date, due_date, estimated_cost, notes
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        condominium.id,
        formData.unit_id ? parseInt(formData.unit_id) : null,
        formData.supplier_id ? parseInt(formData.supplier_id) : null,
        formData.title,
        formData.description || null,
        formData.priority,
        formData.reported_date,
        formData.due_date || null,
        formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        formData.notes || null,
      ]
    );

    setFormData({
      title: '',
      description: '',
      unit_id: '',
      supplier_id: '',
      priority: 'medium',
      reported_date: new Date().toISOString().split('T')[0],
      due_date: '',
      estimated_cost: '',
      notes: '',
    });
    setShowForm(false);
    loadTasks();
  };

  const updateTaskStatus = async (task: MaintenanceTask, status: MaintenanceTask['status']) => {
    let completedDate: string | null = null;
    let actualCost: number | null = task.actual_cost ?? null;

    if (status === 'completed') {
      completedDate = new Date().toISOString().split('T')[0];
      const value = prompt(
        'Indique o custo real (opcional):',
        task.actual_cost != null ? task.actual_cost.toString() : ''
      );
      if (value !== null && value.trim() !== '') {
        const parsed = parseFloat(value);
        if (!Number.isNaN(parsed)) {
          actualCost = parsed;
        }
      }
    }

    if (status !== 'completed') {
      completedDate = null;
    }

    await window.electronAPI.run(
      `UPDATE maintenance_tasks
       SET status = ?, completed_date = ?, actual_cost = ?
       WHERE id = ?`,
      [status, completedDate, actualCost, task.id]
    );
    loadTasks();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja eliminar esta tarefa de manutenção?')) {
      await window.electronAPI.run('DELETE FROM maintenance_tasks WHERE id = ?', [id]);
      loadTasks();
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('pt-PT');
  };

  const formatCurrency = (value?: number | null) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const statusLabel = (status: MaintenanceTask['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="badge badge-success">
            <CheckCircle2 />
            Concluída
          </span>
        );
      case 'in_progress':
        return (
          <span className="badge badge-info">
            <PlayCircle />
            Em execução
          </span>
        );
      default:
        return (
          <span className="badge badge-warning">
            <Wrench />
            Pendente
          </span>
        );
    }
  };

  const counters = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc.total += 1;
        acc[task.status] += 1;
        return acc;
      },
      { total: 0, pending: 0, in_progress: 0, completed: 0 }
    );
  }, [tasks]);

  return (
    <div>
      <div className="stats-grid cols-4">
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Total</h3>
          </div>
          <div className="stat-card-value">{counters.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Pendentes</h3>
          </div>
          <div className="stat-card-value text-warning">
            {counters.pending}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Em execução</h3>
          </div>
          <div className="stat-card-value text-info">
            {counters.in_progress}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Concluídas</h3>
          </div>
          <div className="stat-card-value text-success">
            {counters.completed}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="toolbar">
            <button
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              Todas
            </button>
            <button
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('pending')}
            >
              Pendentes
            </button>
            <button
              className={`btn ${filter === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('in_progress')}
            >
              Em execução
            </button>
            <button
              className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('completed')}
            >
              Concluídas
            </button>
          </div>
          <button
            className="primary-btn"
            onClick={() => {
              setShowForm(!showForm);
              setFormData({
                title: '',
                description: '',
                unit_id: '',
                supplier_id: '',
                priority: 'medium',
                reported_date: new Date().toISOString().split('T')[0],
                due_date: '',
                estimated_cost: '',
                notes: '',
              });
            }}
          >
            <Plus size={20} />
            Nova Tarefa
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
                placeholder="Ex: Revisão do elevador, pintura das escadas..."
              />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Fração</label>
              <select
                value={formData.unit_id}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              >
                <option value="">Área comum</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Fornecedor</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              >
                <option value="">Não atribuído</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Prioridade</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div className="form-group">
              <label>Reportada em *</label>
              <input
                type="date"
                required
                value={formData.reported_date}
                onChange={(e) => setFormData({ ...formData, reported_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Prazo</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Custo estimado</label>
              <input
                type="number"
                step="0.01"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Observações sobre materiais, autorizações, etc."
              />
            </div>
            <div className="toolbar">
              <button type="submit" className="btn btn-primary">
                Criar tarefa
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
              <th>Tarefa</th>
              <th>Fração</th>
              <th>Fornecedor</th>
              <th>Prioridade</th>
              <th>Relatada</th>
              <th>Prazo</th>
              <th>Custo Estimado</th>
              <th>Custo Real</th>
              <th>Estado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td className="table-col-title">
                  <div className="table-title">{task.title}</div>
                  {task.description && <div className="table-subtext">{task.description}</div>}
                  {task.notes && <div className="table-subtext-quiet">{task.notes}</div>}
                </td>
                <td>{task.unit_number || 'Áreas comuns'}</td>
                <td>{task.supplier_name || '-'}</td>
                <td className="text-capitalize">{translatePriority(task.priority)}</td>
                <td>{formatDate(task.reported_date)}</td>
                <td>{formatDate(task.due_date)}</td>
                <td>{formatCurrency(task.estimated_cost)}</td>
                <td>{formatCurrency(task.actual_cost)}</td>
                <td>{statusLabel(task.status)}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-secondary btn-icon-sm"
                      onClick={() => updateTaskStatus(task, 'pending')}
                      title="Repor como pendente"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      className="btn btn-secondary btn-icon-sm"
                      onClick={() => updateTaskStatus(task, 'in_progress')}
                      title="Marcar como em execução"
                    >
                      <PlayCircle size={16} />
                    </button>
                    <button
                      className="btn btn-success btn-icon-sm"
                      onClick={() => updateTaskStatus(task, 'completed')}
                      title="Marcar como concluída"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon-sm"
                      onClick={() => handleDelete(task.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {task.completed_date && (
                    <div className="table-subtext-quiet">
                      Concluída em {formatDate(task.completed_date)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tasks.length === 0 && !showForm && (
          <p className="section-empty">Nenhuma tarefa de manutenção registada.</p>
        )}
      </div>
    </div>
  );
}

function translatePriority(priority: MaintenanceTask['priority']) {
  switch (priority) {
    case 'high':
      return 'Alta';
    case 'low':
      return 'Baixa';
    default:
      return 'Média';
  }
}
