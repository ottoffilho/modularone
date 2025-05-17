
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  CreditCard,
  BellRing,
  Globe,
  Bot,
  PanelLeft,
  Moon,
  Sun,
  Laptop,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function Settings() {
  const { toast } = useToast();
  const { theme, toggleTheme, setTheme } = useTheme();
  const [integrationLoading, setIntegrationLoading] = useState(false);
  
  const handleStripeConnect = () => {
    setIntegrationLoading(true);
    
    // Mock integration setup
    setTimeout(() => {
      toast({
        title: 'Funcionalidade em desenvolvimento',
        description: 'A integração com o Stripe será implementada em breve.',
      });
      setIntegrationLoading(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie as configurações do sistema e integrações.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full border-b pb-0 mb-6">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>
                Personalize a aparência do ModularOne de acordo com suas preferências.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tema</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className="flex-1 justify-start"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="mr-2 h-4 w-4" />
                    Claro
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className="flex-1 justify-start"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    Escuro
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    className="flex-1 justify-start"
                    onClick={() => setTheme('system')}
                  >
                    <Laptop className="mr-2 h-4 w-4" />
                    Sistema
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="sidebar-default">Mostrar barra lateral por padrão</Label>
                <Switch id="sidebar-default" defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Idioma e Região</CardTitle>
              <CardDescription>
                Configure suas preferências regionais.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <select 
                    className="w-full p-2 border rounded-md bg-background"
                    defaultValue="pt-BR"
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label>Formato de Data</Label>
                  <select 
                    className="w-full p-2 border rounded-md bg-background"
                    defaultValue="dd/mm/yyyy"
                  >
                    <option value="dd/mm/yyyy">DD/MM/AAAA</option>
                    <option value="mm/dd/yyyy">MM/DD/AAAA</option>
                    <option value="yyyy-mm-dd">AAAA-MM-DD</option>
                  </select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                Salvar Preferências
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" /> Stripe
              </CardTitle>
              <CardDescription>
                Configure a integração com Stripe para processamento de pagamentos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm">
                  A integração com o Stripe permite processar pagamentos e gerenciar assinaturas de forma segura.
                </p>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="stripe-enabled">Habilitar Stripe</Label>
                  <Switch id="stripe-enabled" />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleStripeConnect} 
                disabled={integrationLoading}
                className="w-full"
              >
                {integrationLoading ? 'Conectando...' : 'Conectar com Stripe'}
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bot className="mr-2 h-5 w-5" /> IA - Inteligência Artificial
              </CardTitle>
              <CardDescription>
                Configure as integrações com serviços de IA para insights e automações.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm">
                  Conecte-se a provedores de IA para análise avançada de dados e recomendações inteligentes.
                </p>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="ai-enabled">Habilitar IA</Label>
                  <Switch id="ai-enabled" defaultChecked />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                Configurar Integrações de IA
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="mr-2 h-5 w-5" /> APIs Externas
              </CardTitle>
              <CardDescription>
                Configure integrações com APIs de distribuidoras de energia e inversores solares.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Conecte-se a APIs externas para importar dados automaticamente de distribuidoras de energia e equipamentos.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                Gerenciar Conexões de API
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BellRing className="mr-2 h-5 w-5" /> Notificações
              </CardTitle>
              <CardDescription>
                Configure como e quando você recebe notificações.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="email-notifications">Notificações por E-mail</Label>
                <Switch id="email-notifications" defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="push-notifications">Notificações no Navegador</Label>
                <Switch id="push-notifications" />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="alert-anomalies">Alertar sobre anomalias de consumo</Label>
                <Switch id="alert-anomalies" defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="alert-bills">Alertar sobre novas faturas</Label>
                <Switch id="alert-bills" defaultChecked />
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                Salvar Preferências
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
