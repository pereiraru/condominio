# Gestao de Condominio

Aplicacao web para gestao de condominio - controlo de quotas, despesas e documentos.

## Funcionalidades

- **Fraccoes**: Gestao de apartamentos/fraccoes com proprietarios, contactos e quotas mensais
- **Credores**: Registo de fornecedores e prestadores de servicos (electricidade, agua, manutencao, etc.)
- **Transacoes**: Registo de pagamentos de quotas e despesas com alocacao multi-mes
- **Documentos**: Upload e organizacao de ficheiros (facturas, actas, contratos)
- **Dashboard**: Visao geral do estado financeiro do condominio
- **Relatorios**: Visao geral anual com grelha de pagamentos por fraccao/credor

### Alocacao de Pagamentos por Mes

O sistema permite alocar um unico pagamento a multiplos meses:
- Na pagina de **Relatorios (Visao Geral)**: clique numa celula para editar a alocacao de meses diretamente
- Na pagina de **Fraccao (Historico)**: celulas clicaveis para reassignar pagamentos a outros meses
- Suporta divisao igual ou valores personalizados por mes

## Tecnologias

- **Framework**: Next.js 14 (App Router)
- **Linguagem**: TypeScript
- **Base de dados**: SQLite com Prisma ORM
- **Estilos**: Tailwind CSS
- **Deploy**: Docker

## Instalacao

### Desenvolvimento Local

```bash
# Instalar dependencias
npm install

# Configurar base de dados
cp .env.example .env
npx prisma generate
npx prisma db push

# Importar dados de Excel (opcional)
npm run import

# Iniciar servidor de desenvolvimento
npm run dev
```

### Producao (Docker)

```bash
docker compose up --build -d
```

A aplicacao fica disponivel em `http://localhost:3100`

## Estrutura do Projeto

```
src/
  app/
    api/                    # API routes
      creditors/            # CRUD credores
      monthly-status/       # Estado mensal de pagamentos
      reports/overview/     # Dados para grelha anual
      transactions/         # CRUD transacoes
      units/                # CRUD fraccoes
        [id]/
          month-transactions/ # Transacoes por mes
          payment-history/    # Historico de pagamentos
          debt/               # Calculo de divida
    dashboard/              # Paginas do dashboard
      creditors/            # Lista e detalhe de credores
      reports/              # Relatorios e visao geral
      transactions/         # Lista de transacoes
      units/                # Lista e detalhe de fraccoes
  components/               # Componentes reutilizaveis
    MonthCalendar.tsx       # Calendario anual de pagamentos
    TransactionEditPanel.tsx # Painel de edicao com alocacao multi-mes
    Sidebar.tsx             # Menu lateral
  lib/
    prisma.ts               # Cliente Prisma singleton
    types.ts                # Interfaces TypeScript
prisma/
  schema.prisma             # Schema da base de dados
```

## Modelo de Dados

- **Unit**: Fraccao/apartamento (codigo, andar, quota mensal, contactos)
- **Owner**: Proprietario(s) de cada fraccao
- **Creditor**: Fornecedor/credor (nome, categoria, valor esperado)
- **Transaction**: Movimento financeiro (pagamento ou despesa)
- **TransactionMonth**: Alocacao de valor de transacao a um mes especifico
- **FeeHistory**: Historico de alteracoes de quotas/valores esperados
- **Document**: Ficheiro anexado

## Calendario de Pagamentos

O sistema inclui um calendario visual que mostra o estado de cada mes:
- **Verde**: Pago
- **Vermelho**: Em divida
- **Amarelo**: Pagamento parcial
- **Azul**: Mes selecionado (modo edicao)

Ao registar transacoes, pode selecionar multiplos meses e o valor e distribuido automaticamente.

## Licenca

Projeto privado.
