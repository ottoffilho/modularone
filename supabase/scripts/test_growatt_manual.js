// Script simples para testar a API Growatt
// Uso: node supabase/scripts/test_growatt_manual.js "username" "password"

import crypto from 'crypto';

async function testGrowattAPI(username, password) {
  console.log(`Testando API Growatt para usuário: ${username}`);
  
  try {
    // Gerar hash MD5 da senha
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
    console.log('Senha convertida para hash MD5');
    
    // Preparar payload para login
    const loginPayload = {
      account: username,
      password: hashedPassword
    };
    
    console.log('Fazendo login na API Growatt...');
    const loginResponse = await fetch('https://openapi.growatt.com/v1/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload)
    });
    
    const loginData = await loginResponse.json();
    console.log('Resposta do login:');
    console.log(JSON.stringify(loginData, null, 2));
    
    if (loginData.error_code === 10011) {
      console.log('\n⚠️ ERRO DE PERMISSÃO NEGADA (10011):');
      console.log('Este erro indica que:');
      console.log('1. As credenciais estão incorretas, OU');
      console.log('2. A conta não possui permissão para acessar a API.');
      console.log('\nSugestão: Verifique as credenciais e contate o suporte Growatt para ativar o acesso à API.');
      return;
    }
    
    if (loginData.error_code !== 0 || !loginData.data?.access_token) {
      console.log('\n❌ FALHA NO LOGIN:');
      console.log(`Código: ${loginData.error_code}`);
      console.log(`Mensagem: ${loginData.error_msg || 'Nenhuma mensagem de erro'}`);
      return;
    }
    
    console.log('\n✅ LOGIN BEM-SUCEDIDO!');
    console.log('Token de acesso obtido.');
    
    // Testar listagem de plantas
    console.log('\nBuscando lista de plantas...');
    const plantListResponse = await fetch('https://openapi.growatt.com/v1/plant/list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.data.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const plantListData = await plantListResponse.json();
    console.log('Resposta da listagem de plantas:');
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
  } catch (error) {
    console.error('Erro durante o teste:', error);
  }
}

// Verificar argumentos de linha de comando
if (process.argv.length < 4) {
  console.log('Uso: node supabase/scripts/test_growatt_manual.js "username" "password"');
  process.exit(1);
}

const username = process.argv[2];
const password = process.argv[3];

testGrowattAPI(username, password); 