import { useEffect, useMemo, useState } from 'react';
import { Condominium, Budget, BudgetCategory, Unit, QuotaSchedule as QuotaScheduleType } from '../types';
import { Download, RefreshCw, Calendar as CalendarIcon, Save, Plus, List, Trash2 } from 'lucide-react';

interface Props {
  condominium: Condominium;
}

interface AllocationOverview {
  category: BudgetCategory;
  total: number;
  participatingUnits: Unit[];
  scopeLabel: string;
}

interface MonthlyCharge {
  unit: Unit;
  monthlyAmounts: number[];
  total: number;
}

const MONTH_LABELS_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartamento',
  store: 'Loja',
  garage: 'Garagem',
  other: 'Outro',
};

type AllocationScope = 'all' | 'unit_types' | 'custom';

export default function QuotaSchedule({ condominium }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categoryUnitsMap, setCategoryUnitsMap] = useState<Record<number, Unit[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStandaloneModal, setShowStandaloneModal] = useState(false);
  const [standaloneForm, setStandaloneForm] = useState({
    title: '',
    totalAmount: '',
    durationMonths: '',
    notes: '',
  });
  const [savedSchedules, setSavedSchedules] = useState<QuotaScheduleType[]>([]);
  const [showSavedSchedules, setShowSavedSchedules] = useState(false);

  useEffect(() => {
    loadBudgets();
    loadUnits();
    loadSavedSchedules();
  }, [condominium]);

  useEffect(() => {
    if (selectedBudgetId) {
      loadCategories(selectedBudgetId);
    } else {
      setCategories([]);
    }
  }, [selectedBudgetId]);

  const loadBudgets = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM budgets WHERE condominium_id = ? ORDER BY year DESC',
      [condominium.id]
    );
    if (result.success) {
      const rows = result.data || [];
      setBudgets(rows);
      if (rows.length > 0) {
        setSelectedBudgetId(rows[0].id);
      }
    }
  };

  const loadUnits = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM units WHERE condominium_id = ? ORDER BY unit_number',
      [condominium.id]
    );
    if (result.success) {
      setUnits(result.data || []);
    }
  };

  const loadSavedSchedules = async () => {
    const result = await window.electronAPI.query(
      `SELECT qs.*, b.year as budget_year
       FROM quota_schedules qs
       LEFT JOIN budgets b ON qs.budget_id = b.id
       WHERE (qs.budget_id IN (SELECT id FROM budgets WHERE condominium_id = ?)
              OR qs.condominium_id = ?)
       ORDER BY qs.generated_at DESC`,
      [condominium.id, condominium.id]
    );
    if (result.success) {
      setSavedSchedules(result.data || []);
    }
  };

  const loadCategories = async (budgetId: number) => {
    setLoading(true);
    const result = await window.electronAPI.query(
      `
        SELECT bc.*
        FROM budget_categories bc
        WHERE bc.budget_id = ?
        ORDER BY bc.name
      `,
      [budgetId]
    );
    if (result.success) {
      const rows = result.data || [];
      setCategories(rows);
      await loadCategoryUnits(rows.map((row: BudgetCategory) => row.id));
    } else {
      setCategories([]);
      setCategoryUnitsMap({});
    }
    setLoading(false);
  };

  const loadCategoryUnits = async (categoryIds: number[]) => {
    if (categoryIds.length === 0) {
      setCategoryUnitsMap({});
      return;
    }

    const placeholders = categoryIds.map(() => '?').join(', ');
    const result = await window.electronAPI.query(
      `
        SELECT bcu.category_id,
               u.*
          FROM budget_category_units bcu
          JOIN units u ON u.id = bcu.unit_id
         WHERE bcu.category_id IN (${placeholders})
         ORDER BY u.unit_number
      `,
      categoryIds
    );

    if (result.success) {
      const map: Record<number, Unit[]> = {};
      (result.data || []).forEach((row: any) => {
        const { category_id, ...unitData } = row;
        if (!map[category_id]) {
          map[category_id] = [];
        }
        map[category_id].push(unitData as Unit);
      });
      setCategoryUnitsMap(map);
    } else {
      setCategoryUnitsMap({});
    }
  };

  const schedule = useMemo(() => {
    if (!selectedBudgetId || categories.length === 0 || units.length === 0) {
      return null;
    }

    const selectedBudget = budgets.find(b => b.id === selectedBudgetId);
    if (!selectedBudget) return null;

    const unitsById = new Map(units.map((unit) => [unit.id, unit]));
    let totalPermilagem = 0;
    units.forEach((unit) => {
      totalPermilagem += unit.permilagem;
    });

    const allocationOverviews: AllocationOverview[] = [];

    const monthlyCharges: MonthlyCharge[] = units.map((unit) => ({
      unit,
      monthlyAmounts: Array(12).fill(0),
      total: 0,
    }));

    const monthlyFactor = 1 / 12;
    const fcrPercentage = (selectedBudget.reserve_fund_percentage || 20) / 100;

    for (const category of categories) {
      const participatingUnits = computeParticipatingUnits(
        category,
        unitsById,
        categoryUnitsMap[category.id]
      );
      const scopeLabel = buildScopeLabel(category, participatingUnits);
      allocationOverviews.push({
        category,
        total: category.planned_amount,
        participatingUnits,
        scopeLabel,
      });

      if (participatingUnits.length === 0 || category.planned_amount === 0) continue;

      // Calculate base amount per month
      const categoryTotalPerMonth = (category.planned_amount || 0) * monthlyFactor;

      // If category contributes to FCR, add the FCR percentage on top
      const fcrAmount = category.contributes_to_fcr ? categoryTotalPerMonth * fcrPercentage : 0;
      const totalPerMonth = categoryTotalPerMonth + fcrAmount;

      let categoryPermilagemSum = 0;
      participatingUnits.forEach((unit) => {
        categoryPermilagemSum += unit.permilagem;
      });

      const divisor = categoryPermilagemSum > 0 ? categoryPermilagemSum : totalPermilagem;
      if (divisor === 0) continue;

      participatingUnits.forEach((unit) => {
        const share = (unit.permilagem / divisor) * totalPerMonth;
        const entry = monthlyCharges.find((charge) => charge.unit.id === unit.id);
        if (!entry) return;
        entry.monthlyAmounts = entry.monthlyAmounts.map((amount) => amount + share);
        entry.total += share * 12;
      });
    }

    monthlyCharges.forEach((row) => {
      row.total = row.monthlyAmounts.reduce((sum, monthAmount) => sum + monthAmount, 0);
    });

    return {
      allocationOverviews,
      monthlyCharges,
    };
  }, [categories, units, categoryUnitsMap, selectedBudgetId]);

  const handleExportCSV = () => {
    if (!schedule) return;
    const lines: string[] = [];
    lines.push(['Fração', ...MONTH_LABELS_PT, 'Total anual'].join(';'));
    schedule.monthlyCharges.forEach(({ unit, monthlyAmounts, total }) => {
      lines.push(
        [
          unit.unit_number,
          ...monthlyAmounts.map((value) => value.toFixed(2).replace('.', ',')),
          total.toFixed(2).replace('.', ','),
        ].join(';')
      );
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const label = schedulesBudgetLabel(budgets, selectedBudgetId);
    link.setAttribute('href', url);
    link.setAttribute('download', `plano-quotas-${label || 'condominio'}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateQuotas = async () => {
    if (!schedule || !selectedBudgetId) return;

    setSaving(true);
    try {
      const insertResult = await window.electronAPI.run(
        `INSERT INTO quota_schedules (budget_id, version, status, notes) VALUES (?, 1, 'finalized', ?)`,
        [selectedBudgetId, `Gerado automaticamente em ${new Date().toLocaleDateString('pt-PT')}`]
      );

      console.log('Insert result:', insertResult);

      if (!insertResult.success) {
        alert(`Erro ao criar plano de quotas: ${insertResult.error || 'Desconhecido'}`);
        return;
      }

      let scheduleId = insertResult.data?.lastID;
      console.log('Schedule ID from lastID:', scheduleId, 'Type:', typeof scheduleId);

      // Workaround: if lastID is 0, query for the actual last inserted record
      if (scheduleId === 0 || scheduleId === null || scheduleId === undefined) {
        console.log('lastID is invalid, querying database for max ID...');
        const maxIdResult = await window.electronAPI.query(
          'SELECT MAX(id) as maxId FROM quota_schedules WHERE budget_id = ?',
          [selectedBudgetId]
        );
        console.log('Max ID query result:', maxIdResult);

        if (maxIdResult.success && maxIdResult.data && maxIdResult.data.length > 0) {
          scheduleId = maxIdResult.data[0].maxId;
          console.log('Found schedule ID from query:', scheduleId);
        }

        if (!scheduleId) {
          alert('Erro ao obter ID do plano de quotas. Verifique a consola para mais detalhes.');
          console.error('Full insert result:', insertResult);
          console.error('Max ID query result:', maxIdResult);
          return;
        }
      }

      for (const { unit, monthlyAmounts } of schedule.monthlyCharges) {
        for (let monthIndex = 0; monthIndex < monthlyAmounts.length; monthIndex++) {
          const amount = monthlyAmounts[monthIndex];
          if (amount > 0) {
            await window.electronAPI.run(
              `INSERT INTO quota_schedule_items (schedule_id, unit_id, month_index, amount) VALUES (?, ?, ?, ?)`,
              [scheduleId, unit.id, monthIndex, amount]
            );

            // Create payment record for this quota
            // Budget year runs from February to January (next year)
            // monthIndex 0 = February, 1 = March, ..., 10 = December, 11 = January (next year)
            const selectedBudget = budgets.find(b => b.id === selectedBudgetId);
            const budgetYear = selectedBudget?.year || new Date().getFullYear();

            // Calculate actual calendar month (Feb = 2, Mar = 3, ..., Dec = 12, Jan = 1)
            const calendarMonth = monthIndex < 11 ? monthIndex + 2 : 1; // Feb-Dec in same year, Jan in next year
            const year = monthIndex < 11 ? budgetYear : budgetYear + 1; // January is in the next year

            const paymentDate = `${year}-${String(calendarMonth).padStart(2, '0')}-01`; // Issued on 1st of each month
            const dueDate = `${year}-${String(calendarMonth).padStart(2, '0')}-15`; // Due on 15th of each month
            const period = `${year}-${String(calendarMonth).padStart(2, '0')}`;

            await window.electronAPI.run(
              `INSERT INTO payments (unit_id, amount, payment_date, due_date, period, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
              [unit.id, amount, paymentDate, dueDate, period]
            );
          }
        }
      }

      alert('Plano de quotas gerado com sucesso! Pagamentos criados nas Quotas.');
      loadSavedSchedules(); // Reload the saved schedules list
    } catch (error) {
      console.error('Erro ao gerar quotas:', error);
      alert('Erro ao gerar plano de quotas.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStandalone = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalAmount = parseFloat(standaloneForm.totalAmount);
    const durationMonths = parseInt(standaloneForm.durationMonths);

    if (!standaloneForm.title.trim()) {
      alert('Por favor, insira um título.');
      return;
    }

    if (isNaN(totalAmount) || totalAmount <= 0) {
      alert('Por favor, insira um valor válido.');
      return;
    }

    if (isNaN(durationMonths) || durationMonths < 1 || durationMonths > 120) {
      alert('Por favor, insira uma duração válida (1-120 meses).');
      return;
    }

    setSaving(true);
    try {
      const insertResult = await window.electronAPI.run(
        `INSERT INTO quota_schedules (condominium_id, is_standalone, total_amount, duration_months, title, version, status, notes) VALUES (?, 1, ?, ?, ?, 1, 'finalized', ?)`,
        [condominium.id, totalAmount, durationMonths, standaloneForm.title, standaloneForm.notes || null]
      );

      if (!insertResult.success) {
        alert('Erro ao criar plano de quotas avulso.');
        return;
      }

      let scheduleId = insertResult.data?.lastID;

      // Workaround: if lastID is 0, query for the actual last inserted record
      if (scheduleId === 0 || scheduleId === null || scheduleId === undefined) {
        const maxIdResult = await window.electronAPI.query(
          'SELECT MAX(id) as maxId FROM quota_schedules WHERE condominium_id = ? AND is_standalone = 1',
          [condominium.id]
        );

        if (maxIdResult.success && maxIdResult.data && maxIdResult.data.length > 0) {
          scheduleId = maxIdResult.data[0].maxId;
        }
      }

      if (!scheduleId) {
        alert('Erro ao obter ID do plano de quotas.');
        return;
      }

      let totalPermilagem = 0;
      units.forEach((unit) => {
        totalPermilagem += unit.permilagem;
      });

      if (totalPermilagem === 0) {
        alert('Erro: Total de permilagem é zero.');
        return;
      }

      const monthlyAmountPerUnit = totalAmount / durationMonths;

      const currentDate = new Date();

      for (const unit of units) {
        const share = (unit.permilagem / totalPermilagem) * monthlyAmountPerUnit;

        for (let monthIndex = 0; monthIndex < durationMonths; monthIndex++) {
          await window.electronAPI.run(
            `INSERT INTO quota_schedule_items (schedule_id, unit_id, month_index, amount) VALUES (?, ?, ?, ?)`,
            [scheduleId, unit.id, monthIndex, share]
          );

          // Create payment record for this standalone quota
          const targetDate = new Date(currentDate);
          targetDate.setMonth(targetDate.getMonth() + monthIndex);
          const year = targetDate.getFullYear();
          const month = targetDate.getMonth() + 1;
          const paymentDate = `${year}-${String(month).padStart(2, '0')}-01`; // Issued on 1st of each month
          const dueDate = `${year}-${String(month).padStart(2, '0')}-15`; // Due on 15th of each month
          const period = `${year}-${String(month).padStart(2, '0')}`;

          await window.electronAPI.run(
            `INSERT INTO payments (unit_id, amount, payment_date, due_date, period, status, notes) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            [unit.id, share, paymentDate, dueDate, period, `Quota avulsa: ${standaloneForm.title}`]
          );
        }
      }

      alert('Plano de quotas avulso criado com sucesso! Pagamentos criados nas Quotas.');
      loadSavedSchedules(); // Reload the saved schedules list
      setShowStandaloneModal(false);
      setStandaloneForm({
        title: '',
        totalAmount: '',
        durationMonths: '',
        notes: '',
      });
    } catch (error) {
      console.error('Erro ao criar plano de quotas avulso:', error);
      alert('Erro ao criar plano de quotas avulso.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllQuotas = async () => {
    if (!confirm('Tem a certeza que deseja apagar TODOS os planos de quotas e pagamentos gerados? Esta ação não pode ser desfeita.')) {
      return;
    }

    setSaving(true);
    try {
      // Delete all quota schedule items
      await window.electronAPI.run('DELETE FROM quota_schedule_items', []);

      // Delete all quota schedules for this condominium
      await window.electronAPI.run(
        'DELETE FROM quota_schedules WHERE budget_id IN (SELECT id FROM budgets WHERE condominium_id = ?) OR condominium_id = ?',
        [condominium.id, condominium.id]
      );

      // Delete all pending payments for this condominium's units
      await window.electronAPI.run(
        `DELETE FROM payments WHERE unit_id IN (SELECT id FROM units WHERE condominium_id = ?) AND status = 'pending'`,
        [condominium.id]
      );

      alert('Todos os planos de quotas e pagamentos foram apagados.');
      loadSavedSchedules();
    } catch (error) {
      console.error('Erro ao apagar quotas:', error);
      alert('Erro ao apagar quotas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {savedSchedules.length > 0 && (
        <div className="card mb-lg">
          <div className="card-header">
            <h3>Quotas Geradas ({savedSchedules.length})</h3>
            <div className="toolbar">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSavedSchedules(!showSavedSchedules)}
              >
                <List size={16} />
                {showSavedSchedules ? 'Ocultar' : 'Ver Todas'}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleClearAllQuotas}
                disabled={saving}
              >
                <Trash2 size={16} />
                Apagar Tudo
              </button>
            </div>
          </div>
          {showSavedSchedules && (
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Título/Ano</th>
                  <th>Data Geração</th>
                  <th>Estado</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {savedSchedules.map((sched: any) => (
                  <tr key={sched.id}>
                    <td>{sched.is_standalone ? 'Avulsa' : 'Orçamento'}</td>
                    <td>
                      {sched.is_standalone
                        ? sched.title
                        : `Orçamento ${sched.budget_year || sched.budget_id}`}
                      {sched.is_standalone && sched.total_amount && (
                        <div className="text-sm text-muted">
                          {formatCurrency(sched.total_amount)} / {sched.duration_months} meses
                        </div>
                      )}
                    </td>
                    <td>{new Date(sched.generated_at).toLocaleString('pt-PT')}</td>
                    <td>
                      <span
                        className={sched.status === 'finalized' ? 'badge badge-success' : 'badge badge-warning'}
                      >
                        {sched.status === 'finalized' ? 'Finalizado' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="text-sm">{sched.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card mb-lg">
        <div className="card-header">
          <div>
            <h3>Selecionar Orçamento</h3>
            <p className="section-subtitle">
              Escolha o orçamento anual para gerar a tabela de quotas mensais por fração.
            </p>
          </div>
          <div className="toolbar wrap">
            <button
              className="btn btn-primary"
              onClick={() => setShowStandaloneModal(true)}
            >
              <Plus size={16} />
              Quota Avulsa
            </button>
            <button className="btn btn-secondary btn-icon-sm" onClick={loadBudgets}>
              <RefreshCw size={16} />
            </button>
            <button
              className="btn btn-success"
              onClick={handleGenerateQuotas}
              disabled={!schedule || saving}
            >
              <Save size={16} />
              {saving ? 'A gerar...' : 'Gerar Quotas'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleExportCSV}
              disabled={!schedule}
            >
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </div>

        {budgets.length === 0 ? (
          <p className="section-empty">Crie um orçamento primeiro para gerar o plano de quotas.</p>
        ) : (
          <div className="toolbar wrap p-md">
            {budgets.map((budget) => (
              <button
                key={budget.id}
                className={`btn ${selectedBudgetId === budget.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedBudgetId(budget.id)}
              >
                <CalendarIcon size={16} />
                {budget.year}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <p className="section-empty">A carregar categorias e frações...</p>
      )}

      {!loading && schedule && (
        <>
          <div className="card mb-lg">
            <div className="card-header">
              <h3>Resumo das categorias</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Total anual</th>
                  <th>Aplicação</th>
                  <th>Nº frações</th>
                </tr>
              </thead>
              <tbody>
                {schedule.allocationOverviews.map(({ category, total, participatingUnits, scopeLabel }) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.category_type || '-'}</td>
                    <td>{formatCurrency(total)}</td>
                    <td>{scopeLabel}</td>
                    <td>{participatingUnits.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Quota mensal por fração</h3>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fração</th>
                    <th>Tipo</th>
                    <th>Permilagem</th>
                    {MONTH_LABELS_PT.map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                    <th>Total anual</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.monthlyCharges.map(({ unit, monthlyAmounts, total }) => (
                    <tr key={unit.id}>
                      <td>{unit.unit_number}</td>
                      <td>{UNIT_TYPE_LABELS[unit.unit_type] || unit.unit_type}</td>
                      <td>{unit.permilagem.toFixed(3)}</td>
                      {monthlyAmounts.map((value, index) => (
                        <td key={index}>{formatCurrency(value)}</td>
                      ))}
                      <td>{formatCurrency(total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && selectedBudgetId && categories.length === 0 && (
        <p className="section-empty">
          Este orçamento não possui categorias. Defina categorias e atribuições para gerar as quotas.
        </p>
      )}

      {showStandaloneModal && (
        <div className="modal-overlay" onClick={() => setShowStandaloneModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Criar Quota Avulsa</h3>
              <button className="modal-close" onClick={() => setShowStandaloneModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateStandalone}>
              <div className="form-group">
                <label htmlFor="title">Título *</label>
                <input
                  id="title"
                  type="text"
                  className="form-control"
                  placeholder="Ex: Reparação urgente do elevador"
                  value={standaloneForm.title}
                  onChange={(e) => setStandaloneForm({ ...standaloneForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="totalAmount">Valor Total (€) *</label>
                <input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control"
                  placeholder="Ex: 200.00"
                  value={standaloneForm.totalAmount}
                  onChange={(e) => setStandaloneForm({ ...standaloneForm, totalAmount: e.target.value })}
                  required
                />
              </div>

                <div className="form-group">
                  <label htmlFor="durationMonths">Duração (meses) *</label>
                  <input
                    id="durationMonths"
                    type="number"
                  min="1"
                  max="120"
                  className="form-control"
                  placeholder="Ex: 3"
                  value={standaloneForm.durationMonths}
                  onChange={(e) =>
                    setStandaloneForm({ ...standaloneForm, durationMonths: e.target.value })
                  }
                  required
                  />
                  <small className="section-hint mt-xs">
                    Número de meses para distribuir o pagamento
                  </small>
                </div>

              <div className="form-group">
                <label htmlFor="notes">Observações</label>
                <textarea
                  id="notes"
                  className="form-control"
                  rows={3}
                  placeholder="Detalhes adicionais..."
                  value={standaloneForm.notes}
                  onChange={(e) => setStandaloneForm({ ...standaloneForm, notes: e.target.value })}
                />
              </div>

              {standaloneForm.totalAmount && standaloneForm.durationMonths && (
                <div className="surface-muted stack-sm">
                  <strong>Resumo:</strong>
                  <p className="text-sm text-muted">
                    Valor mensal por fração (distribuído por permilagem):{' '}
                    <strong>
                      {formatCurrency(
                        parseFloat(standaloneForm.totalAmount) /
                          parseInt(standaloneForm.durationMonths)
                      )}
                    </strong>
                  </p>
                </div>
              )}

              <div className="toolbar toolbar-end">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowStandaloneModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'A criar...' : 'Criar Quota Avulsa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function computeParticipatingUnits(
  category: BudgetCategory,
  unitsById: Map<number, Unit>,
  customUnits: Unit[] | undefined
): Unit[] {
  const scope = (category.allocation_scope as AllocationScope) || 'all';

  switch (scope) {
    case 'unit_types': {
      const types = parseEligibleUnitTypes(category.eligible_unit_types);
      if (types.length === 0) {
        return Array.from(unitsById.values());
      }
      return Array.from(unitsById.values()).filter((unit) => types.includes(unit.unit_type));
    }
    case 'custom': {
      if (customUnits && customUnits.length > 0) {
        return customUnits;
      }
      return [];
    }
    default:
      return Array.from(unitsById.values());
  }
}

function buildScopeLabel(category: BudgetCategory, participatingUnits: Unit[]) {
  const scope = (category.allocation_scope as AllocationScope) || 'all';
  switch (scope) {
    case 'unit_types': {
      const types = parseEligibleUnitTypes(category.eligible_unit_types);
      if (types.length === 0) return 'Todas as frações';
      return `Tipos: ${types.map((type) => UNIT_TYPE_LABELS[type] || type).join(', ')}`;
    }
    case 'custom': {
      if (participatingUnits.length === 0) return 'Frações personalizadas';
      return `Frações: ${participatingUnits.map((unit) => unit.unit_number).join(', ')}`;
    }
    default:
      return 'Todas as frações';
  }
}

function parseEligibleUnitTypes(value?: string) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Não foi possível interpretar os tipos de fração.', error);
    return [];
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
}

function schedulesBudgetLabel(budgets: Budget[], budgetId: number | null) {
  const budget = budgets.find((row) => row.id === budgetId);
  return budget ? `${budget.year}` : '';
}
