# Gestao de Condominio

Aplicacao web para gestao de condominio - controlo de quotas, despesas e documentos.

## Funcionalidades

- **Fraccoes**: Gestao de apartamentos/fraccoes com proprietarios, contactos e quotas mensais
- **Credores**: Registo de fornecedores e prestadores de servicos (electricidade, agua, manutencao, etc.)
- **Transacoes**: Registo de pagamentos de quotas e despesas com calendario mensal
- **Documentos**: Upload e organizacao de ficheiros (facturas, actas, contratos)
- **Dashboard**: Visao geral do estado financeiro do condominio
- **Relatorios**: Analise de receitas e despesas

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
    api/              # API routes
      creditors/      # CRUD credores
      monthly-status/ # Estado mensal de pagamentos
      transactions/   # CRUD transacoes
      units/          # CRUD fraccoes
    dashboard/        # Paginas do dashboard
      creditors/      # Lista e detalhe de credores
      transactions/   # Lista de transacoes
      units/          # Lista e detalhe de fraccoes
  components/         # Componentes reutilizaveis
    MonthCalendar.tsx # Calendario anual de pagamentos
    Sidebar.tsx       # Menu lateral
    TransactionList.tsx
  lib/
    prisma.ts         # Cliente Prisma singleton
    types.ts          # Interfaces TypeScript
prisma/
  schema.prisma       # Schema da base de dados
```

## Modelo de Dados

- **Unit**: Fraccao/apartamento (codigo, andar, quota mensal, contactos)
- **Owner**: Proprietario(s) de cada fraccao
- **Creditor**: Fornecedor/credor (nome, categoria, valor esperado)
- **Transaction**: Movimento financeiro (pagamento ou despesa)
- **Document**: Ficheiro anexado

## Calendario de Pagamentos

O sistema inclui um calendario visual que mostra o estado de cada mes:
- **Verde**: Pago
- **Vermelho**: Em divida
- **Amarelo**: Pagamento parcial

Ao registar transacoes, pode selecionar multiplos meses e o valor e distribuido automaticamente.

## Licenca

Projeto privado.
