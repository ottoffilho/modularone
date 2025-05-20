# Resumo do Problema de Conexão com a API Growatt na Função `get-external-plant-list`

## Objetivo da Funcionalidade
Integrar com a API da Growatt para permitir que usuários do ModularOne importem a lista de suas plantas solares diretamente da plataforma Growatt.

## Fluxo da Edge Function `get-external-plant-list`
1.  Receber o `fabricante_id` (identificando a Growatt).
2.  Autenticar o usuário do ModularOne.
3.  Buscar as credenciais da Growatt (nome de usuário e senha) do usuário, armazenadas de forma segura na tabela `credenciais_servico_usuario`.
4.  Descriptografar a senha da Growatt.
5.  Realizar o login na API da Growatt (`https://openapi.growatt.com/v1/user/login`):
    *   Envia o `account` (nome de usuário Growatt).
    *   Envia a `password` (senha Growatt, após aplicarmos um hash MD5, conforme documentação da Growatt).
6.  Se o login for bem-sucedido, obter um `access_token`.
7.  Usar o `access_token` para chamar o endpoint `https://openapi.growatt.com/v1/plant/list` e obter a lista de plantas.
8.  Padronizar e retornar a lista de plantas para o frontend do ModularOne.

## Problema Encontrado
Ao tentar executar o passo 5 (login na API da Growatt), a API da Growatt retorna o seguinte erro:
```json
{
  "error_msg": "error_permission_denied",
  "data": "",
  "error_code": 10011
}
```
Este erro impede a obtenção do `access_token` e, consequentemente, a listagem das plantas. A Edge Function `get-external-plant-list` reporta isso como uma falha, resultando em um erro 502 (Bad Gateway) para o cliente frontend.

## Análise da Causa Raiz
O erro `error_permission_denied` (código 10011) retornado diretamente pela API da Growatt indica que:
*   As credenciais (nome de usuário ou a senha original antes do hash MD5) fornecidas à API são inválidas.
*   OU a conta de usuário Growatt associada a essas credenciais não possui as permissões necessárias habilitadas em sua plataforma para permitir interações via API.

A lógica dentro da Edge Function `get-external-plant-list` para realizar o login (incluindo o hash MD5 da senha) está implementada conforme a documentação da Growatt para o endpoint `openapi.growatt.com/v1/user/login`.

## Ações Necessárias (Responsabilidade do Usuário/Desenvolvedor do ModularOne)
Para resolver este problema, as seguintes verificações e ações devem ser tomadas:

1.  **Verificar Precisão das Credenciais Armazenadas:**
    *   Acesse o sistema ModularOne e vá para a seção de gerenciamento de integrações.
    *   Edite a integração configurada para a Growatt.
    *   Confirme **cuidadosamente** se o "User Name" (nome de usuário) e a "Password" (senha) da Growatt cadastrados estão absolutamente corretos. Erros de digitação são comuns.
    *   Se houver dúvida, reinsira as credenciais corretas e salve.

2.  **Confirmar Permissões na Plataforma Growatt:**
    *   Acesse diretamente a plataforma da Growatt (o portal web do fabricante, não necessariamente o aplicativo ShinePhone).
    *   Verifique nas configurações da conta do usuário Growatt (para a qual as credenciais foram fornecidas) se existe alguma seção específica para "Acesso via API", "Permissões de API", "Desenvolvedor" ou similar.
    *   Certifique-se de que o acesso via API esteja habilitado para esta conta. Algumas plataformas exigem uma ativação explícita.

3.  **Teste Direto das Credenciais (Opcional, mas Recomendado):**
    *   Utilize uma ferramenta como Postman ou um script simples para tentar fazer login diretamente no endpoint `https://openapi.growatt.com/v1/user/login`.
    *   No corpo da requisição POST (JSON), envie:
        ```json
        {
          "account": "SEU_USUARIO_GROWATT_CORRETO",
          "password": "HASH_MD5_DA_SUA_SENHA_GROWATT_CORRETA" 
        }
        ```
    *   Isso ajudará a isolar se o problema está nas credenciais em si ou em alguma outra parte do fluxo.

4.  **Contato com Suporte Growatt:**
    *   Se as credenciais estiverem corretas e as permissões parecerem estar ativas (ou se não houver opção visível para gerenciá-las), entre em contato com o suporte técnico da Growatt.
    *   Informe o erro `error_code: 10011 (error_permission_denied)` ao tentar usar o endpoint `openapi.growatt.com/v1/user/login`. Eles poderão fornecer informações específicas sobre o que esse código de erro significa para a conta em questão ou se há requisitos adicionais.

## Conclusão
A resolução deste problema de conexão depende da validação e correção das credenciais da Growatt e/ou da configuração de permissões na plataforma da Growatt. O código da Edge Function `get-external-plant-list` no ModularOne está preparado para interagir com a API assim que o login for bem-sucedido. 