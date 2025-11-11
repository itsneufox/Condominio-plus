import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Condominium, Budget, BudgetCategory, Unit } from '../types';

const CATEGORY_TYPE_OPTIONS = [
  { value: 'utilities', label: 'Serviços Públicos' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'services', label: 'Serviços' },
  { value: 'insurance', label: 'Seguros' },
  { value: 'administration', label: 'Administração' },
  { value: 'reserve', label: 'Fundo de Reserva' },
  { value: 'other', label: 'Outros' },
  { value: 'general', label: 'Geral' },
];

const CATEGORY_TYPE_LABELS = CATEGORY_TYPE_OPTIONS.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

const UNIT_TYPE_LABELS = {
  apartment: 'Apartamento',
  store: 'Loja',
  garage: 'Garagem',
  other: 'Outro',
} as const;

const SUGGESTED_CATEGORIES = [
  {
    name: 'Água',
    category_type: 'utilities',
    description: 'Consumo de água, saneamento e contadores partilhados.',
  },
  {
    name: 'Energia',
    category_type: 'utilities',
    description: 'Eletricidade das áreas comuns, garagens e sistemas técnicos.',
  },
  {
    name: 'Limpeza',
    category_type: 'services',
    description: 'Serviços de limpeza, higienização e consumíveis.',
  },
  {
    name: 'Manutenção Geral',
    category_type: 'maintenance',
    description: 'Pequenas reparações, iluminação e conservação do edifício.',
  },
  {
    name: 'Seguros',
    category_type: 'insurance',
    description: 'Seguro multirriscos, responsabilidade civil e apoio jurídico.',
  },
  {
    name: 'Elevadores',
    category_type: 'maintenance',
    description: 'Contratos de manutenção e inspeções obrigatórias dos elevadores.',
  },
  {
    name: 'Jardinagem',
    category_type: 'services',
    description: 'Manutenção de jardins e espaços verdes comuns.',
  },
  {
    name: 'Limpeza de Garagem',
    category_type: 'services',
    description: 'Lavagem e limpeza periódica das garagens.',
  },
  {
    name: 'Gestão Administrativa',
    category_type: 'administration',
    description: 'Honorários de administração, contabilidade e correspondência.',
  },
  {
    name: 'Fundo de Reserva',
    category_type: 'reserve',
    description: 'Reforço do fundo comum para obras estruturais.',
  },
];

interface Props {
  condominium: Condominium;
  onOpenQuotaSchedule?: () => void;
}

export default function BudgetManager({ condominium, onOpenQuotaSchedule }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [actualsByCategory, setActualsByCategory] = useState<
    Record<number, { expense: number; income: number }>
  >({});
  const [categoryUnitsMap, setCategoryUnitsMap] = useState<Record<number, Unit[]>>({});
  const [units, setUnits] = useState<Unit[]>([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [allocationCategoryId, setAllocationCategoryId] = useState<number | null>(null);
  const [allocationCategoryName, setAllocationCategoryName] = useState('');
  const [allocationForm, setAllocationForm] = useState({
    scope: 'all' as 'all' | 'unit_types' | 'custom',
    unitTypes: {
      apartment: true,
      store: true,
      garage: true,
      other: true,
    },
    unitIds: [] as number[],
  });

  const [budgetForm, setBudgetForm] = useState({
    year: new Date().getFullYear(),
    total_amount: '',
    reserve_fund_percentage: '20',
    reserve_fund_amount: '',
    description: '',
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    planned_amount: '',
    description: '',
    category_type: 'general',
    contributes_to_fcr: true,
  });

  useEffect(() => {
    loadBudgets();
    loadUnits();
  }, [condominium]);

  useEffect(() => {
    if (selectedBudget) {
      loadCategories(selectedBudget.id);
    } else {
      setCategories([]);
      setActualsByCategory({});
    }
  }, [selectedBudget]);

  const loadBudgets = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM budgets WHERE condominium_id = ? ORDER BY year DESC',
      [condominium.id]
    );
    if (result.success) {
      setBudgets(result.data || []);
      if (result.data && result.data.length > 0 && !selectedBudget) {
        setSelectedBudget(result.data[0]);
      }
    }
  };

  const loadCategories = async (budgetId: number) => {
    const result = await window.electronAPI.query(
      'SELECT * FROM budget_categories WHERE budget_id = ? ORDER BY name',
      [budgetId]
    );
    if (result.success) {
      const data = result.data || [];
      setCategories(data);
      await Promise.all([loadCategoryActuals(budgetId), loadCategoryAllocations(budgetId)]);
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

  const loadCategoryAllocations = async (budgetId: number) => {
    const result = await window.electronAPI.query(
      `SELECT bcu.category_id,
              u.*
         FROM budget_category_units bcu
         JOIN budget_categories bc ON bc.id = bcu.category_id
         JOIN units u ON u.id = bcu.unit_id
        WHERE bc.budget_id = ?
        ORDER BY u.unit_number`,
      [budgetId]
    );

    if (result.success) {
      const map: Record<number, Unit[]> = {};
      (result.data || []).forEach((row: Unit & { category_id: number }) => {
        const { category_id, ...unitData } = row as any;
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

  const loadCategoryActuals = async (budgetId: number) => {
    const result = await window.electronAPI.query(
      `SELECT category_id,
              SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
              SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income
         FROM transactions
        WHERE category_id IN (
          SELECT id FROM budget_categories WHERE budget_id = ?
        )
     GROUP BY category_id`,
      [budgetId]
    );

    if (result.success) {
      const totals: Record<number, { expense: number; income: number }> = {};
      (result.data || []).forEach((row: any) => {
        if (row.category_id != null) {
          totals[row.category_id] = {
            expense: row.total_expense || 0,
            income: row.total_income || 0,
          };
        }
      });
      setActualsByCategory(totals);
    } else {
      setActualsByCategory({});
    }
  };

  const openAllocationModal = (category: BudgetCategory) => {
    setAllocationCategoryId(category.id);
    setAllocationCategoryName(category.name);
    const scope = (category.allocation_scope as 'all' | 'unit_types' | 'custom') || 'all';
    const parsedTypes = parseEligibleUnitTypes(category.eligible_unit_types);

    let unitTypeState = defaultUnitTypeState(scope === 'all');

    if (scope === 'unit_types') {
      unitTypeState = defaultUnitTypeState(false);
      parsedTypes.forEach((type) => {
        if (type in unitTypeState) {
          unitTypeState[type as keyof typeof unitTypeState] = true;
        }
      });
    }

    if (scope === 'custom') {
      unitTypeState = defaultUnitTypeState(false);
    }

    const selectedUnits = (categoryUnitsMap[category.id] || []).map((unit) => unit.id);

    setAllocationForm({
      scope,
      unitTypes: unitTypeState,
      unitIds: selectedUnits,
    });
    setShowAllocationModal(true);
  };

  const handleAllocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocationCategoryId) return;

    const scope = allocationForm.scope;
    let eligibleUnitTypes: string | null = null;

    if (scope === 'unit_types') {
      const selected = Object.entries(allocationForm.unitTypes)
        .filter(([, checked]) => checked)
        .map(([type]) => type);
      if (selected.length === 0) {
        alert('Selecione pelo menos um tipo de fração.');
        return;
      }
      eligibleUnitTypes = JSON.stringify(selected);
    }

    if (scope === 'custom' && allocationForm.unitIds.length === 0) {
      alert('Selecione pelo menos uma fração para atribuição personalizada.');
      return;
    }

    await window.electronAPI.run(
      'UPDATE budget_categories SET allocation_scope = ?, eligible_unit_types = ? WHERE id = ?',
      [scope, eligibleUnitTypes, allocationCategoryId]
    );

    await window.electronAPI.run('DELETE FROM budget_category_units WHERE category_id = ?', [
      allocationCategoryId,
    ]);

    if (scope === 'custom') {
      for (const unitId of allocationForm.unitIds) {
        await window.electronAPI.run(
          'INSERT INTO budget_category_units (category_id, unit_id) VALUES (?, ?)',
          [allocationCategoryId, unitId]
        );
      }
    }

    if (selectedBudget) {
      await loadCategories(selectedBudget.id);
    }

    setShowAllocationModal(false);
    setAllocationCategoryId(null);
  };

  const handleAllocationScopeChange = (scope: 'all' | 'unit_types' | 'custom') => {
    setAllocationForm((prev) => ({
      ...prev,
      scope,
      unitIds: scope === 'custom' ? prev.unitIds : [],
      unitTypes:
        scope === 'unit_types'
          ? prev.unitTypes
          : scope === 'all'
            ? defaultUnitTypeState(true)
            : defaultUnitTypeState(false),
    }));
  };

  const toggleUnitType = (type: keyof typeof UNIT_TYPE_LABELS) => {
    setAllocationForm((prev) => ({
      ...prev,
      unitTypes: {
        ...prev.unitTypes,
        [type]: !prev.unitTypes[type],
      },
    }));
  };

  const toggleUnitSelection = (unitId: number) => {
    setAllocationForm((prev) => {
      const exists = prev.unitIds.includes(unitId);
      return {
        ...prev,
        unitIds: exists ? prev.unitIds.filter((id) => id !== unitId) : [...prev.unitIds, unitId],
      };
    });
  };

  const closeAllocationModal = () => {
    setShowAllocationModal(false);
    setAllocationCategoryId(null);
    setAllocationCategoryName('');
  };

  const defaultUnitTypeState = (selected = false) => ({
    apartment: selected,
    store: selected,
    garage: selected,
    other: selected,
  });

  const parseEligibleUnitTypes = (value?: string): Array<keyof typeof UNIT_TYPE_LABELS> => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Não foi possível interpretar os tipos de fração.', error);
      return [];
    }
  };

  const getAllocationLabel = (
    scope: string,
    eligibleUnitTypes: string | undefined,
    categoryUnits: Unit[],
    allUnits: Unit[]
  ) => {
    switch (scope) {
      case 'unit_types': {
        const types = parseEligibleUnitTypes(eligibleUnitTypes);
        if (types.length === 0) return 'Tipos específicos (não definidos)';
        return `Tipos: ${types
          .map((type) => UNIT_TYPE_LABELS[type] || type)
          .join(', ')}`;
      }
      case 'custom': {
        if (categoryUnits.length === 0) return 'Frações personalizadas (não definidas)';
        return `Frações: ${categoryUnits.map((unit) => unit.unit_number).join(', ')}`;
      }
      default: {
        const totalUnits = allUnits.length;
        return totalUnits > 0
          ? `Todas as frações (${totalUnits})`
          : 'Todas as frações';
      }
    }
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalAmount = parseFloat(budgetForm.total_amount);
    const percentage = parseFloat(budgetForm.reserve_fund_percentage) || 20;
    const reserveFundAmount = (totalAmount * percentage) / 100;

    await window.electronAPI.run(
      'INSERT INTO budgets (condominium_id, year, total_amount, reserve_fund_amount, reserve_fund_percentage, description) VALUES (?, ?, ?, ?, ?, ?)',
      [
        condominium.id,
        budgetForm.year,
        totalAmount,
        reserveFundAmount,
        percentage,
        budgetForm.description,
      ]
    );

    setBudgetForm({
      year: new Date().getFullYear(),
      total_amount: '',
      reserve_fund_percentage: '20',
      reserve_fund_amount: '',
      description: '',
    });
    setShowBudgetForm(false);
    loadBudgets();
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget) return;

    await window.electronAPI.run(
      'INSERT INTO budget_categories (budget_id, name, planned_amount, description, category_type, contributes_to_fcr) VALUES (?, ?, ?, ?, ?, ?)',
      [
        selectedBudget.id,
        categoryForm.name,
        parseFloat(categoryForm.planned_amount),
        categoryForm.description,
        categoryForm.category_type,
        categoryForm.contributes_to_fcr ? 1 : 0,
      ]
    );

    setCategoryForm({ name: '', planned_amount: '', description: '', category_type: 'general', contributes_to_fcr: true });
    setShowCategoryForm(false);
    loadCategories(selectedBudget.id);
  };

  const handleDeleteBudget = async (id: number) => {
    if (confirm('Tem certeza que deseja eliminar este orçamento?')) {
      await window.electronAPI.run(
        'DELETE FROM budget_category_units WHERE category_id IN (SELECT id FROM budget_categories WHERE budget_id = ?)',
        [id]
      );
      await window.electronAPI.run('DELETE FROM budget_categories WHERE budget_id = ?', [id]);
      await window.electronAPI.run('DELETE FROM budgets WHERE id = ?', [id]);
      loadBudgets();
      setSelectedBudget(null);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('Tem certeza que deseja eliminar esta categoria?')) {
      await window.electronAPI.run('DELETE FROM budget_categories WHERE id = ?', [id]);
      if (selectedBudget) {
        loadCategories(selectedBudget.id);
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const totalPlanned = categories.reduce((sum, cat) => sum + cat.planned_amount, 0);
  const totalActualExpenses = categories.reduce(
    (sum, cat) => sum + (actualsByCategory[cat.id]?.expense || 0),
    0
  );
  const totalActualIncome = categories.reduce(
    (sum, cat) => sum + (actualsByCategory[cat.id]?.income || 0),
    0
  );
  const totalsByType = categories.reduce<Record<string, number>>((acc, cat) => {
    const type = cat.category_type || 'general';
    acc[type] = (acc[type] || 0) + cat.planned_amount;
    return acc;
  }, {});
  const actualsByType = categories.reduce<Record<string, number>>((acc, cat) => {
    const type = cat.category_type || 'general';
    acc[type] = (acc[type] || 0) + (actualsByCategory[cat.id]?.expense || 0);
    return acc;
  }, {});
  const remainingBudget = selectedBudget
    ? selectedBudget.total_amount - totalActualExpenses + totalActualIncome
    : 0;
  const plannedDifference = totalPlanned - totalActualExpenses;

  const existingCategoryNames = categories.map((cat) => cat.name.toLowerCase());
  const suggestedAvailable = SUGGESTED_CATEGORIES.filter(
    (suggestion) => !existingCategoryNames.includes(suggestion.name.toLowerCase())
  );

  const handleAddSuggestedCategory = (suggestion: (typeof SUGGESTED_CATEGORIES)[number]) => {
    setCategoryForm({
      name: suggestion.name,
      planned_amount: '',
      description: suggestion.description,
      category_type: suggestion.category_type,
      contributes_to_fcr: true,
    });
    setShowCategoryForm(true);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>Selecionar Orçamento</h3>
          <div className="toolbar">
            {onOpenQuotaSchedule && (
              <button className="btn btn-secondary" onClick={onOpenQuotaSchedule}>
                Plano de Quotas
              </button>
            )}
            <button className="primary-btn" onClick={() => setShowBudgetForm(!showBudgetForm)}>
              <Plus size={20} />
              Novo Orçamento
            </button>
          </div>
        </div>

        {showBudgetForm && (
          <form onSubmit={handleBudgetSubmit} className="section-stack">
            <div className="form-group">
              <label>Ano *</label>
              <input
                type="number"
                required
                value={budgetForm.year}
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, year: parseInt(e.target.value) })
                }
              />
            </div>
            <div className="form-group">
              <label>Valor Total *</label>
              <input
                type="number"
                step="0.01"
                required
                value={budgetForm.total_amount}
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, total_amount: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Percentagem do Fundo de Reserva (%) *</label>
              <input
                type="number"
                step="0.01"
                min="10"
                max="100"
                required
                value={budgetForm.reserve_fund_percentage}
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, reserve_fund_percentage: e.target.value })
                }
              />
              <small className="section-hint">
                Mínimo legal: 10% | Valor calculado: {budgetForm.total_amount && budgetForm.reserve_fund_percentage
                  ? ((parseFloat(budgetForm.total_amount) * parseFloat(budgetForm.reserve_fund_percentage)) / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
                  : '0,00 €'}
              </small>
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={budgetForm.description}
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, description: e.target.value })
                }
              />
            </div>
            <div className="toolbar">
              <button type="submit" className="btn btn-primary">
                Criar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowBudgetForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="toolbar wrap">
          {budgets.map((budget) => (
            <button
              key={budget.id}
              className={`btn ${selectedBudget?.id === budget.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedBudget(budget)}
            >
              {budget.year}
            </button>
          ))}
        </div>

        {budgets.length === 0 && !showBudgetForm && (
          <p className="section-empty">Nenhum orçamento registado.</p>
        )}
      </div>

      {selectedBudget && (
        <>
          <div className="card">
            <div className="card-header">
              <div>
                <h3>Orçamento {selectedBudget.year}</h3>
                <p className="section-subtitle">{selectedBudget.description}</p>
              </div>
              <button
                className="btn btn-danger"
                onClick={() => handleDeleteBudget(selectedBudget.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid-summary">
              <div>
                <span>Orçamento Total</span>
                <strong>{formatCurrency(selectedBudget.total_amount)}</strong>
              </div>
              <div>
                <span>Fundo de Reserva ({selectedBudget.reserve_fund_percentage || 10}%)</span>
                <strong>{formatCurrency(selectedBudget.reserve_fund_amount)}</strong>
              </div>
            </div>

            <div className="grid-stats mt-lg">
              <div className="surface-muted">
                <div className="section-subtitle">Total Planeado</div>
                <div className="table-value-strong">{formatCurrency(totalPlanned)}</div>
              </div>
              <div className="surface-muted">
                <div className="section-subtitle">Total Gasto</div>
                <div className="table-value-strong">{formatCurrency(totalActualExpenses)}</div>
              </div>
              <div className="surface-muted">
                <div className="section-subtitle">Saldo Disponível</div>
                <div className={`table-value-strong ${remainingBudget < 0 ? 'text-danger' : ''}`}>
                  {formatCurrency(remainingBudget)}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Categorias de Despesas</h3>
              <button
                className="primary-btn"
                onClick={() => setShowCategoryForm(!showCategoryForm)}
              >
                <Plus size={20} />
                Nova Categoria
              </button>
            </div>

            {showCategoryForm && (
              <form onSubmit={handleCategorySubmit} className="section-stack">
                <div className="form-group">
                  <label>Nome *</label>
                  <input
                    type="text"
                    required
                    value={categoryForm.name}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Valor Planeado *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={categoryForm.planned_amount}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, planned_amount: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Descrição</label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Tipo *</label>
                  <select
                    required
                    value={categoryForm.category_type}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        category_type: e.target.value,
                      })
                    }
                  >
                    {CATEGORY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-check cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoryForm.contributes_to_fcr}
                      onChange={(e) =>
                        setCategoryForm({ ...categoryForm, contributes_to_fcr: e.target.checked })
                      }
                    />
                    Contribui para o FCR (Fundo Comum de Reserva)
                  </label>
                  <small className="section-hint">
                    Desmarque para despesas que não devem gerar FCR (ex: seguros obrigatórios)
                  </small>
                </div>
                <div className="toolbar">
                  <button type="submit" className="btn btn-primary">
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCategoryForm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <table className="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Valor Base</th>
                  <th>FCR ({selectedBudget.reserve_fund_percentage || 10}%)</th>
                  <th>Total</th>
                  <th>Gasto</th>
                  <th>Diferença</th>
                  <th>Aplicação</th>
                  <th>Descrição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const actualExpense = actualsByCategory[category.id]?.expense || 0;
                  const fcrPercentage = (selectedBudget.reserve_fund_percentage || 10) / 100;
                  const fcrAmount = category.contributes_to_fcr ? category.planned_amount * fcrPercentage : 0;
                  const totalWithFcr = category.planned_amount + fcrAmount;
                  const difference = totalWithFcr - actualExpense;
                  const scope = category.allocation_scope || 'all';
                  const scopeLabel = getAllocationLabel(
                    scope,
                    category.eligible_unit_types,
                    categoryUnitsMap[category.id] || [],
                    units
                  );
                  return (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td>{CATEGORY_TYPE_LABELS[category.category_type || 'general']}</td>
                      <td>{formatCurrency(category.planned_amount)}</td>
                      <td className={category.contributes_to_fcr ? 'text-success' : 'text-muted'}>
                        {category.contributes_to_fcr ? formatCurrency(fcrAmount) : '-'}
                      </td>
                      <td className="table-value-strong">{formatCurrency(totalWithFcr)}</td>
                      <td>{formatCurrency(actualExpense)}</td>
                      <td className={`table-value-strong ${difference < 0 ? 'text-danger' : ''}`}>
                        {formatCurrency(difference)}
                      </td>
                      <td>
                        <div className="section-stack tight">
                          <span className="table-note">{scopeLabel}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon-sm"
                            onClick={() => openAllocationModal(category)}
                          >
                            Definir
                          </button>
                        </div>
                      </td>
                      <td>{category.description || '-'}</td>
                      <td>
                          <button
                            className="btn btn-danger btn-icon-sm"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                      </td>
                    </tr>
                  );
                })}
                {categories.length > 0 && (
                <tr className="table-subheader">
                    <td>Total</td>
                    <td></td>
                    <td>{formatCurrency(totalPlanned)}</td>
                    <td>{formatCurrency(totalActualExpenses)}</td>
                    <td className={`table-value-strong ${plannedDifference < 0 ? 'text-danger' : ''}`}>
                      {formatCurrency(plannedDifference)}
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>

            {categories.length === 0 && !showCategoryForm && (
              <p className="section-empty">Nenhuma categoria registada.</p>
            )}

            {suggestedAvailable.length > 0 && (
              <div className="section-stack">
                <h4 className="section-title">Categorias Sugeridas</h4>
                <div className="grid-auto-sm">
                  {suggestedAvailable.map((suggestion) => (
                    <div key={suggestion.name} className="surface-muted flex-row wrap justify-between">
                      <div className="flex-column stack-sm">
                        <div className="table-value-strong">{suggestion.name}</div>
                        <div className="text-sm text-muted">{suggestion.description}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleAddSuggestedCategory(suggestion)}
                      >
                        Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(totalsByType).length > 0 && (
              <div className="section-stack">
                <h4 className="section-title">Distribuição por Tipo</h4>
                <div className="grid-stats">
                  {Object.entries(totalsByType).map(([type, amount]) => {
                    const actual = actualsByType[type] || 0;
                    const diff = amount - actual;
                    return (
                      <div key={type} className="surface-muted stack-sm">
                        <div className="text-sm text-muted">
                          {CATEGORY_TYPE_LABELS[type] || 'Geral'}
                        </div>
                        <div className="table-value-strong">
                          Planeado: {formatCurrency(amount)}
                        </div>
                        <div className="text-sm">Gasto: {formatCurrency(actual)}</div>
                        <div className={`text-sm table-value-strong ${diff < 0 ? 'text-danger' : 'text-success'}`}>
                          Saldo: {formatCurrency(diff)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showAllocationModal && (
        <div className="modal-backdrop" onClick={closeAllocationModal}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3>Aplicação da categoria: {allocationCategoryName}</h3>
            </div>
            <form onSubmit={handleAllocationSubmit} className="modal-content">
              <div className="form-group">
                <label>Aplicar a *</label>
                <div className="grid-auto-xs">
                  {(
                    [
                      { value: 'all', label: 'Todas as frações' },
                      { value: 'unit_types', label: 'Tipos de fração' },
                      { value: 'custom', label: 'Frações selecionadas' },
                    ] as const
                  ).map((option) => (
                    <label key={option.value} className="form-check">
                      <input
                        type="radio"
                        name="allocation-scope"
                        value={option.value}
                        checked={allocationForm.scope === option.value}
                        onChange={() => handleAllocationScopeChange(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              {allocationForm.scope === 'unit_types' && (
                <div className="form-group">
                  <label>Tipos de fração incluídos *</label>
                  <div className="grid-auto-xs">
                    {(Object.keys(UNIT_TYPE_LABELS) as Array<keyof typeof UNIT_TYPE_LABELS>).map((type) => (
                      <label key={type} className="form-check">
                        <input
                          type="checkbox"
                          checked={allocationForm.unitTypes[type]}
                          onChange={() => toggleUnitType(type)}
                        />
                        {UNIT_TYPE_LABELS[type]}
                      </label>
                    ))}
                  </div>
                  <small className="section-hint mt-xs">
                    Apenas frações destes tipos participam nas despesas desta categoria.
                  </small>
                </div>
              )}

              {allocationForm.scope === 'custom' && (
                <div className="form-group">
                  <label>Selecione as frações *</label>
                  <div className="stack-sm scroll-area">
                    {(Object.keys(UNIT_TYPE_LABELS) as Array<keyof typeof UNIT_TYPE_LABELS>).map((type) => {
                      const unitsOfType = units.filter((unit) => unit.unit_type === type);
                      if (unitsOfType.length === 0) return null;
                      return (
                        <div key={type}>
                          <div className="table-value-strong">
                            {UNIT_TYPE_LABELS[type]} ({unitsOfType.length})
                          </div>
                          <div className="grid-auto-xs">
                            {unitsOfType.map((unit) => (
                              <label key={unit.id} className="form-check">
                                <input
                                  type="checkbox"
                                  checked={allocationForm.unitIds.includes(unit.id)}
                                  onChange={() => toggleUnitSelection(unit.id)}
                                />
                                {unit.unit_number}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <small className="section-hint mt-xs">
                    Apenas as frações assinaladas participam na distribuição desta categoria.
                  </small>
                </div>
              )}

              <div className="form-group">
                <label>Resumo</label>
                <div className="surface-muted">
                  {getAllocationLabel(
                    allocationForm.scope,
                    allocationForm.scope === 'unit_types'
                      ? JSON.stringify(
                          Object.entries(allocationForm.unitTypes)
                            .filter(([, checked]) => checked)
                            .map(([type]) => type)
                        )
                      : undefined,
                    allocationForm.scope === 'custom'
                      ? units.filter((unit) => allocationForm.unitIds.includes(unit.id))
                      : [],
                    units
                  )}
                </div>
              </div>

              <div className="toolbar">
                <button type="submit" className="btn btn-primary">
                  Guardar
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeAllocationModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
