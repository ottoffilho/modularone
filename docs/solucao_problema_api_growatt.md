# Correção da Integração com a API Growatt no ModularOne

Este documento descreve os problemas identificados e as soluções implementadas para corrigir a integração com a API Growatt no projeto ModularOne.

## Problemas Identificados

1. **Inconsistência no Nome da Tabela**:
   - As Edge Functions estavam usando `fabricantes_api`, mas a migração inicial criou `fabricantes_equipamentos`.

2. **Inconsistência no Schema de Credenciais Growatt**:
   - A definição inicial do `api_config_schema` usava `username_growatt` e `password_growatt`, mas as funções buscavam por `username` e `password`.
   - Isso causava a necessidade de lógica de fallback complexa para tentar diferentes nomes de campo.

3. **Validação de Credenciais Insuficiente**:
   - A função `validateCredentialsWithManufacturer` estava apenas simulando a validação em vez de testar com a API real da Growatt.

4. **Logging Insuficiente**:
   - Faltavam logs críticos para diagnosticar problemas, especialmente para entender erros específicos da API Growatt.

## Soluções Implementadas

### 1. Migração SQL para Correção (02_correct_growatt_api_schema.sql)

Uma nova migração SQL foi criada para:

- Verificar se a tabela `fabricantes_api` existe e, se existir, migrar seus dados para `fabricantes_equipamentos`.
- Atualizar o `api_config_schema` para o fabricante Growatt, padronizando os nomes dos campos para `username` e `password`.
- Atualizar as credenciais existentes, migrando os valores de `username_growatt` para `username` e `password_growatt` para `password`.

### 2. Atualização das Edge Functions

#### get-external-plant-list/index.ts
- Corrigida a referência da tabela para `fabricantes_equipamentos`.
- Melhorado o logging para incluir mais detalhes sobre as credenciais disponíveis.
- Melhorado o tratamento de erros da API Growatt, especialmente para o erro 10011 (permission_denied).
- Adicionados logs mais detalhados das requisições e respostas para facilitar o diagnóstico.

#### manage-user-integration-credentials/index.ts
- Corrigida a referência da tabela para `fabricantes_equipamentos`.
- Melhorada a função `validateCredentialsWithManufacturer` para testar as credenciais usando a API Growatt.
- Adicionado logging mais detalhado para o processo de validação.

### 3. Script de Teste para API Growatt

Um novo script `supabase/scripts/test_growatt_integration.ts` foi criado para:

- Testar diretamente as credenciais Growatt sem depender da aplicação completa.
- Verificar tanto o login quanto a listagem de plantas.
- Fornecer diagnóstico detalhado, especialmente para o erro 10011 (permission_denied).
- Ajudar a isolar problemas específicos da API vs. problemas de integração no ModularOne.

## Como Aplicar as Correções

1. **Aplicar a Migração SQL**:
   ```bash
   supabase db push
   ```
   Ou executar manualmente a migração através do SQL Editor no Supabase Studio.

2. **Reimplantar as Edge Functions**:
   ```bash
   cd supabase/functions
   supabase functions deploy get-external-plant-list
   supabase functions deploy manage-user-integration-credentials
   ```

3. **Testar a Integração**:
   ```bash
   cd supabase/scripts
   deno run --allow-net test_growatt_integration.ts <seu_usuario_growatt> <sua_senha_growatt>
   ```

4. **Verificar os Logs**:
   - Após reimplantar as funções, acesse o Supabase Studio.
   - Vá para "Edge Functions" e verifique os logs de `get-external-plant-list` e `manage-user-integration-credentials`.

## Diagnóstico de Erros Comuns

### Erro 10011 (permission_denied)

Este erro geralmente indica um dos seguintes problemas:

1. **Credenciais Incorretas**: O nome de usuário ou senha estão incorretos.
2. **Permissões Insuficientes**: A conta Growatt não tem permissão para acessar a API.
3. **Conta Bloqueada**: A conta pode estar bloqueada temporariamente devido a tentativas de login mal-sucedidas.

### Solução para Erro 10011:

- Verifique se o nome de usuário e senha estão corretos.
- Faça login no portal web da Growatt para confirmar que a conta está ativa.
- Entre em contato com o suporte da Growatt para ativar o acesso à API para sua conta.
- Use o script `test_growatt_integration.ts` para verificar se o problema está nas credenciais ou na integração ModularOne. 