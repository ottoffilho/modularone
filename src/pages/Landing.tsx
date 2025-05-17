import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Zap, Brain, LineChart, Shield, CheckCircle, Bot } from "lucide-react";
import { Logo } from "@/components/ui/logo";
export default function Landing() {
  return <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full bg-background/95 backdrop-blur-md z-50 border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              Recursos
            </a>
            <a href="#ai" className="text-sm font-medium hover:text-primary transition-colors">
              Inteligência Artificial
            </a>
            <a href="#about" className="text-sm font-medium hover:text-primary transition-colors">
              Sobre
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/register">
              <Button className="bg-[#daa916] hover:bg-[#daa916]/90 text-primary-foreground">Cadastre-se</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="relative pt-32 pb-20 px-4 text-white" 
        style={{
          backgroundImage: "url('/src/assets/images/paineis-solares-em-um-prado.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/60 z-0"></div> {/* Overlay escuro */}
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-white mb-6 border border-primary/50">
                Plataforma de Gestão de Energia
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                Revolucione sua <span className="text-[#daa916]">gestão de energia</span> com IA
              </h1>
              <p className="text-xl text-gray-200 mb-8">
                Consolidação inteligente, análises avançadas e otimização automática para suas unidades consumidoras de energia.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/register">
                  <Button size="lg" className="gap-2 bg-[#daa916] hover:bg-[#daa916]/90 text-primary-foreground">
                    Começar agora <ChevronRight size={18} />
                  </Button>
                </Link>
                <a href="#features">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="border-[#daa916] text-[#daa916] hover:bg-[#daa916] hover:text-primary-foreground"
                  >
                    Saiba mais
                  </Button>
                </a>
              </div>
            </div>
            {/* Imagem Lateral Removida */}
            <div>
                {/* Espaço reservado para possível gráfico/mockup futuro, se necessário */}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Recursos poderosos para maximizar seu potencial energético</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Uma plataforma completa para gerenciar, analisar e otimizar seu consumo de energia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
              <div className="p-3 bg-[#daa916]/10 rounded-lg w-fit mb-5">
                <Zap className="h-6 w-6 text-[#daa916]" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Gestão Completa de Unidades</h3>
              <p className="text-muted-foreground">
                Gerencie múltiplas unidades consumidoras de diferentes clientes em uma única plataforma intuitiva.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
              <div className="p-3 bg-[#daa916]/10 rounded-lg w-fit mb-5">
                <LineChart className="h-6 w-6 text-[#daa916]" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Análise Avançada de Dados</h3>
              <p className="text-muted-foreground">
                Visualize tendências de consumo, compare períodos e descubra oportunidades de economia em tempo real.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
              <div className="p-3 bg-[#daa916]/10 rounded-lg w-fit mb-5">
                <Shield className="h-6 w-6 text-[#daa916]" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Segurança Avançada</h3>
              <p className="text-muted-foreground">
                Seus dados estão seguros com nossa infraestrutura robusta e controles de acesso baseados em permissões.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section id="ai" className="py-20 px-4 bg-gradient-to-b from-background to-primary/5">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 md:order-1">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-primary/30 rounded-3xl blur-3xl opacity-20"></div>
              <div className="relative z-10 bg-card rounded-xl border p-8 shadow-xl">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-[#daa916]/10 rounded-full">
                    <Bot className="h-6 w-6 text-[#daa916]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Assistente IA ModularOne</h3>
                    <p className="text-sm text-muted-foreground">Trabalhando para otimizar sua energia</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4 max-w-[80%]">
                    <p className="text-sm">Com base nos seus dados de consumo, identificamos um padrão que sugere economia potencial de 15% se redistribuir o uso de equipamentos de alto consumo para fora do horário de pico.</p>
                  </div>
                  
                  <div className="bg-[#daa916]/20 rounded-lg p-4 max-w-[80%] ml-auto">
                    <p className="text-sm text-gray-700">Quais equipamentos específicos devo realocar e para quais horários?</p>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-4 max-w-[80%]">
                    <p className="text-sm">Recomendo mover condicionadores de ar e máquinas industriais para o período entre 22h e 6h, quando a tarifa é 40% menor. Posso criar um plano detalhado de operação otimizada para sua aprovação.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="order-1 md:order-2">
              <div className="inline-block rounded-full bg-[#daa916]/10 px-4 py-1.5 text-sm font-medium text-[#daa916] mb-6">
                Inteligência Artificial
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Descubra insights poderosos com nossa IA especializada
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Nossa tecnologia de IA analisa seus padrões de consumo, identifica desperdícios e sugere estratégias personalizadas para maximizar a eficiência energética e reduzir custos.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-[#daa916] flex-shrink-0 mt-0.5" />
                  <span>Previsões precisas de consumo baseadas em histórico e fatores externos</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-[#daa916] flex-shrink-0 mt-0.5" />
                  <span>Detecção automática de anomalias e alertas preventivos</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-[#daa916] flex-shrink-0 mt-0.5" />
                  <span>Recomendações personalizadas para economia baseadas em seu perfil</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-gradient-to-br from-[#daa916] to-yellow-600 rounded-2xl p-8 md:p-12 text-center text-primary-foreground">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pronto para transformar sua gestão de energia?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Junte-se a milhares de usuários que já estão economizando energia e reduzindo custos com o ModularOne.
            </p>
            <Link to="/register">
              <Button size="lg" variant="secondary" className="gap-2 text-yellow-700 hover:text-yellow-800">
                Começar gratuitamente <ChevronRight size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-12 px-4 mt-auto">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Logo className="h-8 w-8" />
                
              </div>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Transformando a maneira como você gerencia e otimiza seu consumo de energia com tecnologia de ponta e inteligência artificial.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Navegação Rápida</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-[#daa916] transition-colors">Início</a></li>
                <li><a href="#features" className="text-muted-foreground hover:text-[#daa916] transition-colors">Recursos</a></li>
                <li><a href="#ai" className="text-muted-foreground hover:text-[#daa916] transition-colors">IA</a></li>
                <li><a href="#about" className="text-muted-foreground hover:text-[#daa916] transition-colors">Sobre</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Conta</h3>
              <ul className="space-y-2">
                <li><Link to="/login" className="text-muted-foreground hover:text-[#daa916] transition-colors">Login</Link></li>
                <li><Link to="/register" className="text-muted-foreground hover:text-[#daa916] transition-colors">Cadastro</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-6 text-center text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} ModularOne. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>;
}