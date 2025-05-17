
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Bot, Send, Sparkles, FileText, Zap, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export default function AIAssistant() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      content: 'Olá! Sou o assistente IA do ModularOne. Como posso ajudar você com a análise e otimização do seu consumo de energia?',
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async () => {
    if (!prompt.trim()) return;

    // Add user message
    const userMessage = {
      content: prompt,
      sender: 'user' as const,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    
    // Save prompt and clear input
    const userPrompt = prompt;
    setPrompt('');
    setLoading(true);

    try {
      // This is a mockup of the AI response since we don't have the actual integration yet
      setTimeout(() => {
        const mockResponses = [
          "Com base na análise das suas últimas faturas, identifiquei um padrão de consumo elevado entre 18h e 21h nos dias úteis. Recomendo distribuir o uso de equipamentos de alto consumo fora desse horário de pico para reduzir custos.",
          "Analisando seus dados de consumo, notei que sua geração solar está 15% abaixo do esperado para o período. Isto pode indicar sujeira nos painéis ou sombreamento parcial. Uma manutenção poderia aumentar a eficiência.",
          "Comparando com consumidores similares, seu consumo está 20% acima da média. As principais áreas de oportunidade são: otimização do sistema de refrigeração e instalação de sensores de presença para iluminação.",
          "De acordo com as últimas 6 faturas, seu consumo tem aumentado consistentemente em 5% ao mês. Recomendo uma inspeção para verificar possíveis fugas de energia ou equipamentos operando fora das especificações ideais."
        ];
        
        const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
        
        const assistantMessage = {
          content: randomResponse,
          sender: 'assistant' as const,
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, assistantMessage]);
        setLoading(false);
      }, 1500);
    } catch (error) {
      console.error('Erro na comunicação com a IA:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar sua solicitação. Tente novamente mais tarde.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assistente IA</h1>
        <p className="text-muted-foreground mt-2">
          Utilize nossa inteligência artificial para obter insights e otimizar seu consumo de energia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chat Section */}
        <Card className="md:col-span-2">
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-full">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>ModularOne IA</CardTitle>
                <CardDescription>Assistente para otimização de energia</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col h-[500px]">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.sender === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p>{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"></div>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="border-t p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Escreva sua pergunta aqui..."
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={loading || !prompt.trim()}>
                    {loading ? 'Processando...' : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggestions and Info Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Sugestões de perguntas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  'Como posso reduzir meu consumo de energia em horário de pico?',
                  'Existe alguma anomalia no consumo da minha UC principal?',
                  'Quais equipamentos estão consumindo mais energia?',
                  'Qual o potencial de economia se eu otimizar minha operação?',
                ].map((suggestion, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="w-full justify-start h-auto py-2 px-4 text-left"
                    onClick={() => {
                      setPrompt(suggestion);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                O que a IA pode fazer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                  <span className="text-sm">Analisar padrões de consumo e identificar anomalias</span>
                </li>
                <li className="flex items-start gap-2">
                  <Activity className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                  <span className="text-sm">Prever consumo futuro com base no histórico</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                  <span className="text-sm">Recomendar estratégias de otimização personalizadas</span>
                </li>
                <li className="flex items-start gap-2">
                  <Bot className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                  <span className="text-sm">Responder dúvidas sobre seus dados de energia</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
