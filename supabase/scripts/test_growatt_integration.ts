// Script para testar a integração com a API Growatt
// Execute com:
// deno run --allow-net supabase/scripts/test_growatt_integration.ts <username> <password>

async function testGrowattLogin(username: string, password: string): Promise<void> {
  console.log(`Testando login na API Growatt para usuário: ${username}`);
  
  try {
    // Gerar hash MD5 da senha
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log(`Senha convertida para hash MD5`);
    
    // Montar payload conforme documentação da Growatt
    const loginPayload = { 
      account: username, 
      password: hashedPassword 
    };
    
    // Fazer login na API Growatt
    console.log(`Fazendo login na API Growatt...`);
    const loginResponse = await fetch('https://openapi.growatt.com/v1/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload),
    });
    
    const responseText = await loginResponse.text();
    console.log(`Resposta da API (status ${loginResponse.status}):`);
    
    try {
      const jsonData = JSON.parse(responseText);
      console.log(JSON.stringify(jsonData, null, 2));
      
      // Verificar código de erro específico
      if (jsonData.error_code === 10011) {
        console.log(`\n⚠️ ERRO DE PERMISSÃO NEGADA (10011):`);
        console.log(`Este erro indica que:`);
        console.log(`1. As credenciais (nome de usuário ou senha) estão incorretas, OU`);
        console.log(`2. A conta não possui as permissões necessárias para acessar a API.`);
        console.log(`\nSugestão: Verifique suas credenciais e contate o suporte da Growatt para ativar o acesso à API.`);
      } else if (jsonData.error_code === 0 && jsonData.data?.access_token) {
        console.log(`\n✅ LOGIN BEM-SUCEDIDO!`);
        console.log(`Access token obtido. Você pode usar esse token para fazer chamadas adicionais à API.`);
        
        // Opcionalmente, testar chamada para listar plantas
        console.log(`\nTestando listagem de plantas...`);
        const plantListResponse = await fetch('https://openapi.growatt.com/v1/plant/list', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jsonData.data.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        const plantListText = await plantListResponse.text();
        try {
          const plantListData = JSON.parse(plantListText);
          console.log(`Resposta da listagem de plantas (status ${plantListResponse.status}):`);
          console.log(JSON.stringify(plantListData, null, 2));
          
          if (plantListData.error_code === 0) {
            const plants = Array.isArray(plantListData.data) 
              ? plantListData.data 
              : (plantListData.data?.plants || []);
              
            console.log(`\nNúmero de plantas encontradas: ${plants.length}`);
            plants.forEach((plant, index) => {
              console.log(`\nPlanta ${index + 1}:`);
              console.log(`- ID: ${plant.plant_id}`);
              console.log(`- Nome: ${plant.plant_name}`);
              console.log(`- Localização: ${plant.city || ''}, ${plant.country || ''}`);
              console.log(`- Potência nominal: ${plant.nominal_power || 'N/A'}`);
            });
          }
        } catch (e) {
          console.error(`Erro ao processar resposta da listagem de plantas:`, e);
          console.log(`Resposta bruta:`, plantListText);
        }
      } else {
        console.log(`\n❌ FALHA NO LOGIN:`);
        console.log(`Código de erro: ${jsonData.error_code}`);
        console.log(`Mensagem: ${jsonData.error_msg || 'Nenhuma mensagem de erro fornecida'}`);
      }
    } catch (jsonError) {
      console.error(`Erro ao processar resposta como JSON:`, jsonError);
      console.log(`Resposta bruta:`, responseText);
    }
  } catch (error) {
    console.error(`Erro durante o teste:`, error);
  }
}

// Verificar argumentos de linha de comando
if (Deno.args.length < 2) {
  console.log(`Uso: deno run --allow-net test_growatt_integration.ts <username> <password>`);
  Deno.exit(1);
}

const [username, password] = Deno.args;
await testGrowattLogin(username, password); 