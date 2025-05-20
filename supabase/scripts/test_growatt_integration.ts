#!/usr/bin/env -S deno run --allow-net

/**
 * Script para testar a integração com a API Growatt
 * Uso: deno run --allow-net test_growatt_integration.ts <username> <password>
 */

// Importar a biblioteca js-md5 para gerar hash MD5
import md5 from 'npm:js-md5@0.8.3';

// Validar argumentos
if (Deno.args.length < 2) {
  console.error("Uso: deno run --allow-net test_growatt_integration.ts <username> <password>");
  Deno.exit(1);
}

const username = Deno.args[0];
const password = Deno.args[1];

console.log(`Testando integração Growatt para o usuário: ${username}`);

// Função para converter ArrayBuffer para string hexadecimal
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function testGrowattLogin(username: string, password: string): Promise<void> {
  try {
    // Gerar hash MD5 da senha usando a biblioteca js-md5
    const hashedPassword = md5(password);
    
    console.log(`Enviando requisição para API Growatt (senha hasheada com MD5): ${username}`);
    
    const loginPayload = { account: username, password: hashedPassword };
    console.log("Payload de login:", JSON.stringify({...loginPayload, password: "[SENHA_HASH_OCULTO]"}));
    
    const loginResponse = await fetch('https://openapi.growatt.com/v1/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload)
    });
    
    console.log(`Status da resposta: ${loginResponse.status}`);
    
    const responseText = await loginResponse.text();
    console.log(`Resposta da API Growatt: ${responseText}`);
    
    try {
      const responseJson = JSON.parse(responseText);
      console.log("\n===== ANÁLISE DA RESPOSTA =====");
      
      if (responseJson.error_code === 0 && responseJson.data?.access_token) {
        console.log("✅ LOGIN BEM-SUCEDIDO!");
        console.log(`Token de acesso: ${responseJson.data.access_token.substring(0, 15)}... (truncado por segurança)`);
        
        // Se o login for bem-sucedido, tentar listar as plantas
        await testListPlants(responseJson.data.access_token);
      } else {
        console.log("❌ LOGIN FALHOU!");
        console.log(`Código de erro: ${responseJson.error_code}`);
        console.log(`Mensagem: ${responseJson.error_msg}`);
        
        if (responseJson.error_code === 10011) {
          console.log("\n===== DIAGNÓSTICO DE ERRO 10011 (PERMISSION DENIED) =====");
          console.log("Este erro geralmente indica um dos seguintes problemas:");
          console.log("1. Credenciais incorretas (username/password)");
          console.log("2. A conta não tem permissão para acessar a API");
          console.log("3. A conta pode estar bloqueada ou requer ativação especial para API");
          console.log("\nRECOMENDAÇÕES:");
          console.log("- Verifique se o username e senha estão corretos");
          console.log("- Entre em contato com o suporte da Growatt para ativar o acesso à API para sua conta");
          console.log("- Tente fazer login no portal web da Growatt para verificar se a conta está ativa");
        }
      }
    } catch (error) {
      console.error("Erro ao analisar a resposta JSON:", error);
    }
  } catch (error) {
    console.error("Erro ao fazer a requisição:", error);
  }
}

async function testListPlants(token: string): Promise<void> {
  try {
    console.log("\n===== TESTANDO LISTAGEM DE PLANTAS =====");
    const plantsResponse = await fetch('https://openapi.growatt.com/v1/plant/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`Status da resposta (listagem de plantas): ${plantsResponse.status}`);
    
    const plantsResponseText = await plantsResponse.text();
    try {
      const plantsJson = JSON.parse(plantsResponseText);
      
      if (plantsJson.error_code === 0 && plantsJson.data) {
        console.log("✅ LISTAGEM DE PLANTAS BEM-SUCEDIDA!");
        const plants = Array.isArray(plantsJson.data) ? plantsJson.data : (plantsJson.data.plants || []);
        console.log(`Número de plantas encontradas: ${plants.length}`);
        
        if (plants.length > 0) {
          console.log("\nPrimeiras plantas encontradas:");
          plants.slice(0, 3).forEach((plant: any, index: number) => {
            console.log(`\nPlanta ${index + 1}:`);
            console.log(`- ID: ${plant.plant_id}`);
            console.log(`- Nome: ${plant.plant_name}`);
            console.log(`- Potência: ${plant.nominal_power || 'N/A'} kW`);
            console.log(`- Status: ${plant.status || 'N/A'}`);
          });
          
          if (plants.length > 3) {
            console.log(`\n...e mais ${plants.length - 3} plantas.`);
          }
        } else {
          console.log("Nenhuma planta encontrada para este usuário.");
        }
      } else {
        console.log("❌ LISTAGEM DE PLANTAS FALHOU!");
        console.log(`Código de erro: ${plantsJson.error_code}`);
        console.log(`Mensagem: ${plantsJson.error_msg || plantsJson.error_message || 'Sem mensagem de erro'}`);
      }
    } catch (error) {
      console.error("Erro ao analisar a resposta JSON da listagem de plantas:", error);
      console.log("Resposta bruta:", plantsResponseText);
    }
  } catch (error) {
    console.error("Erro ao fazer a requisição de listagem de plantas:", error);
  }
}

// Executar o teste
await testGrowattLogin(username, password); 