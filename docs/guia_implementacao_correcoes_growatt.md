# Guia de Implementação das Correções para API Growatt

Este guia detalha os passos necessários para implementar as correções na integração com a API Growatt no ModularOne.

## Resumo do Problema

A integração com a API Growatt está falhando com erro `error_permission_denied` (código 10011) devido a:

1. Inconsistência entre a tabela usada nas Edge Functions (`fabricantes_api`) e a criada pela migração (`fabricantes_equipamentos`).
2. Diferenças nos nomes dos campos de credenciais (`username_growatt`/`password_growatt` vs. `username`/`password`).
3. Falta de validação real das credenciais durante o cadastro.
4. Logs insuficientes para diagnóstico adequado.

## Passos para Implementação

### Passo 1: Aplicar a Migração SQL

A migração SQL corrige os problemas estruturais e padroniza os dados.

1. Navegue até a raiz do projeto:
   ```bash
   cd modularone
   ```

2. Aplique a migração usando o Supabase CLI:
   ```bash
   supabase db push
   ```

   Alternativamente, você pode executar manualmente o SQL em `supabase/migrations/02_correct_growatt_api_schema.sql` no SQL Editor do Supabase Studio.

### Passo 2: Atualizar as Edge Functions

As Edge Functions foram atualizadas para usar a tabela correta e melhorar o tratamento de erros e logs.

1. Primeiro, implante a função `get-external-plant-list`:
   ```bash
   cd supabase/functions
   supabase functions deploy get-external-plant-list
   ```

2. Em seguida, implante a função `manage-user-integration-credentials`:
   ```bash
   supabase functions deploy manage-user-integration-credentials
   ```

### Passo 3: Testar a Integração com o Script de Teste

O script de teste ajuda a isolar problemas específicos da API Growatt.

1. Execute o script de teste com suas credenciais Growatt:
   ```bash
   cd supabase/scripts
   deno run --allow-net test_growatt_integration.ts <seu_usuario_growatt> <sua_senha_growatt>
   ```

2. Analise a saída para determinar se a conexão com a API Growatt funciona quando isolada do resto da aplicação.

### Passo 4: Verificar os Logs das Edge Functions

Monitore os logs para entender o comportamento em produção.

1. Acesse o Supabase Studio para seu projeto.
2. Navegue até "Edge Functions" e selecione a função `get-external-plant-list`.
3. Clique em "Logs" para verificar os logs da função.
4. Repita para a função `manage-user-integration-credentials`.

### Passo 5: Testar no Frontend

Finalmente, teste a integração completa através da interface do usuário.

1. Acesse o ModularOne no navegador.
2. Vá para a seção de integrações (geralmente em Configurações > Integrações).
3. Adicione ou edite uma integração com a Growatt, fornecendo suas credenciais.
4. Tente listar as plantas disponíveis.

## Diagnóstico de Problemas Persistentes

Se você ainda enfrentar o erro 10011 após implementar todas as correções, aqui estão algumas etapas adicionais de diagnóstico:

### Verificação do Formato de Hash MD5

A API Growatt requer que a senha seja convertida em hash MD5. Verifique se o formato está correto:

1. Use uma ferramenta online de hash MD5 para converter sua senha.
2. Compare o hash resultante com o que está sendo gerado no script de teste.
3. Verifique se o hash está em letras minúsculas e tem 32 caracteres.

### Verificar Permissões da Conta Growatt

Algumas contas Growatt precisam de permissões especiais para acessar a API:

1. Faça login no portal web da Growatt com as mesmas credenciais.
2. Verifique se há alguma opção para ativar o acesso à API.
3. Entre em contato com o suporte da Growatt e forneça o código de erro 10011.
4. Pergunte especificamente se sua conta tem permissão para acessar a API openapi.growatt.com.

### Verificação de Proxies ou Firewalls

Se seu ambiente estiver atrás de um proxy ou firewall:

1. Verifique se as requisições para `openapi.growatt.com` estão sendo bloqueadas.
2. Teste a partir de uma rede diferente, como uma rede celular ou VPN.
3. Tente usar o script de teste a partir de um serviço de cloud shell, como GitHub Codespaces.

## Conclusão

Após seguir estes passos, a integração com a API Growatt deve estar funcionando corretamente. Se você continuar enfrentando problemas, revise os logs detalhados das Edge Functions e use o script de teste para isolar o problema.

A documentação detalhada da arquitetura de integração está disponível em `supabase/docs/integracao_fabricantes.md` para referência futura. 