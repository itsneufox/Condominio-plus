# Condomínio+

> ⚠️ **Estado do Projeto**: Esta aplicação encontra-se em desenvolvimento ativo e **não está pronta para produção**. Utilize apenas para testes e desenvolvimento.

Uma aplicação desktop para gestão financeira de condomínios portugueses, construída com ElectronJS.

## Funcionalidades

- **Gestão de Múltiplos Condomínios**: Gerir vários edifícios numa única aplicação
- **Orçamento Anual**: Criar e acompanhar orçamentos anuais com categorias de despesas
- **Fundo de Reserva**: Controlar separadamente o fundo de reserva do condomínio
- **Movimentos Financeiros**: Registar receitas e despesas com categorização
- **Gestão de Frações**: Registar frações e proprietários com permilagens
- **Gestão de Pessoas**: Registar proprietários, arrendatários e outros
- **Gestão de Fornecedores**: Manter registo de fornecedores de serviços
- **Manutenção**: Acompanhar tarefas de manutenção e reparações
- **Reuniões**: Registar assembleias de condóminos
- **Comunicações**: Gerir comunicações aos condóminos
- **Plano de Quotas**: Gerar e gerir planos de pagamento de quotas
- **Painel de Controlo**: Visualização rápida do estado financeiro
- **Base de Dados Local**: Todos os dados armazenados localmente em SQLite

## Requisitos

- Node.js 18 ou superior
- npm ou yarn

## Instalação

```bash
# Instalar dependências
npm install

# Executar em modo de desenvolvimento
npm run dev

# Construir para produção (Windows)
npm run build:win

# Construir para produção (macOS)
npm run build:mac

# Construir para produção (Linux)
npm run build:linux
```

## Como Usar

1. **Criar um Condomínio**: Comece por criar um novo condomínio na secção "Condomínios"
2. **Adicionar Frações**: Registe as frações do edifício com as respetivas permilagens
3. **Registar Pessoas**: Adicione proprietários e arrendatários
4. **Criar Orçamento**: Defina o orçamento anual e as categorias de despesas
5. **Registar Movimentos**: Adicione receitas e despesas conforme ocorrem
6. **Acompanhar**: Use o painel para ver o estado financeiro em tempo real

## Estrutura de Dados

### Condomínios
- Nome, Morada, NIPC

### Frações
- Número da fração
- Proprietário (nome, email, telefone)
- Permilagem (para cálculo de quotas)

### Orçamentos
- Ano
- Valor total
- Fundo de reserva
- Categorias de despesas

### Movimentos
- Tipo (receita/despesa)
- Categoria
- Valor
- Data
- Fundo de reserva (sim/não)

## Tecnologias

- **ElectronJS**: Framework para aplicação desktop
- **React**: Interface de utilizador
- **TypeScript**: Tipagem estática
- **SQLite**: Base de dados local
- **Vite**: Build tool e dev server

## Desenvolvimento

A aplicação está dividida em duas partes:

1. **Processo Principal (Electron)**: Gestão da janela e base de dados
2. **Processo de Renderização (React)**: Interface de utilizador

## Licença

MPL-2.0 license
