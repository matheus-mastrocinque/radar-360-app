# Prompt para o Google Stitch

Cole o bloco abaixo em [stitch.withgoogle.com](https://stitch.withgoogle.com), no modo web (desktop). Depois peça as versões de celular com o segundo prompt, mais abaixo.

Este é um protótipo para comparar com o produto real. A paleta está provisória até escolhermos um dos cinco logos.

```text
Crie o protótipo de alta fidelidade de um web app chamado OLHARIUM: uma plataforma brasileira de cibersegurança pessoal. Todos os textos da interface em português do Brasil.

O PRODUTO
O Olharium é "o olho que vigia por você". Ele faz três coisas:
1. Monitora se o e-mail, o CPF ou o telefone da pessoa apareceram em vazamentos de dados e mostra um score de exposição de 0 a 100, sempre explicado.
2. Tem um copiloto de incidentes: a pessoa conta o que aconteceu ("caí num golpe do Pix") ou abre um vazamento detectado, e recebe um plano de ação em três fases (em até 15 minutos, na primeira hora e nas próximas 24 horas). Para vazamentos, gera a notificação LGPD à empresa e, se ela não responder em 15 dias, a petição à ANPD.
3. Audita a rede de casa e o computador em Wi-Fi público, apontando aparelhos e serviços inseguros.
Público: brasileiros comuns, não técnicos. Tom: protetor, calmo, confiante e direto. Nunca assustador, nunca estética "hacker de filme".

IDENTIDADE VISUAL (provisória)
- Símbolo: um olho único e vigilante, com íris carmesim e marcas geométricas que giram em volta da pupila, como uma varredura de radar. Desenho original e minimalista; não use símbolos de anime, mangá ou de qualquer franquia existente.
- Cores: grafite quase preto #0E0F13 para fundos escuros e o hero; carmesim #C8102E como cor da marca (botões principais, destaques, o olho); off-white #F7F7F8 para as superfícies do app; cinzas neutros para texto secundário. Estados: sucesso #1F9D6B, alerta #D98E04, perigo #E5484D (diferente do carmesim da marca; use os dois com contraste suficiente).
- Tipografia: Sora para títulos e Inter para o texto (Google Fonts).
- Estilo: moderno e sofisticado, com muito respiro, cantos arredondados (12 px), sombras suaves, ícones de linha. Um motivo sutil de anéis concêntricos/radar pode aparecer no hero. Contraste mínimo WCAG AA.

TELAS (desktop, 1440 px)
1. LANDING
   - Hero escuro com o olho em destaque. Título: "Seus dados vazaram? Saiba o que fazer agora." Subtítulo explicando monitoramento, plano de ação e LGPD em uma frase.
   - Botão principal grande: "Entrar como demo" (com a nota "persona fictícia, sem cadastro"). Botão secundário: "Como funciona".
   - Três cards: "Monitoramento contínuo", "Copiloto de incidentes", "Auditoria da sua rede".
   - Seção "Como protegemos você": "Não mostramos o dado vazado, só onde e quando ele apareceu", "CPF e telefone guardados como código irreversível (HMAC)", "Não pedimos nem guardamos senhas".
   - Rodapé: "As orientações são informativas e não são assessoria jurídica."

2. PAINEL (usuário logado, persona fictícia "Ana Demo")
   - Barra superior: logo Olharium; navegação "Painel", "Copiloto"; selo "Modo demo"; botão "Sair".
   - Card principal: score de exposição 58/100, nível "Alto", com um medidor circular inspirado na íris do olho. Ao lado, a lista dos fatores que somam pontos (ex.: "CPF — 2 vazamentos: peso 10 + 2 pela repetição = 12 pontos"; "Rede de casa: 1 achado alto — 8 pontos").
   - Card "Vazamentos": linhas com empresa, data e categorias expostas em chips, NUNCA o dado. Exemplos: "TeleConecta Telecom (fictícia) — ago/2025 — CPF, Telefone, Endereço — Novo"; "LojaFácil (fictícia) — mar/2024 — E-mail, Senha (cifrada)"; "Clínica Vida+ (fictícia) — nov/2025 — Nome, Dados de saúde, Convênio". Cada linha tem o botão "Plano de resposta".
   - Card "Ativos monitorados": e-mail "a***@exemplo.com", CPF "***.456.***-**", telefone "(11) *****-*678", com selo "Verificado".
   - Card "Sua rede": duas colunas, "Rede de casa" e "Rede pública", com achados por gravidade em badges (ex.: "Telnet aberto no roteador — Alto", "UPnP ativo — Baixo", "Firewall ativo — OK").

3. COPILOTO DE INCIDENTES
   - Título "O que aconteceu?" e uma caixa de texto grande ("Conte com suas palavras. Não escreva senhas; CPF e cartão são apagados antes de salvar.").
   - Chips para escolher o tipo, opcional: "Golpe do Pix", "Celular roubado", "Conta invadida ou WhatsApp clonado", "Link ou site falso", "Conta ou dívida em meu nome".
   - Botão "Gerar plano de resposta".
   - Seção "Vazamentos sem plano" com botão "Gerar plano" em cada um.
   - Lista "Seus incidentes": título, tipo, barra de progresso (ex.: 4 de 11 passos) e status LGPD ("Aguardando resposta — faltam 9 dias" ou "Prazo vencido").

4. PLANO DE RESPOSTA (incidente "Vazamento na TeleConecta Telecom (fictícia)")
   - Cabeçalho com o tipo, a origem ("Detectado pelo Olharium") e a barra de progresso.
   - Três colunas, uma por fase: "Agora — em até 15 min", "Na primeira hora — em até 1 h", "Nas próximas 24 horas — em até 24 h". Cada passo é um checkbox com título, uma frase de detalhe e, quando houver, um link oficial (ex.: "Registrato do Banco Central", "consumidor.gov.br", "Celular Seguro").
   - Painel "Notificação LGPD ao encarregado": um stepper com três etapas ("Enviar ao encarregado", "Aguardar até 15 dias", "Resposta ou petição à ANPD"), banner vermelho "O prazo terminou em 08/11/2026 sem resposta", bloco com o texto da petição e o botão "Copiar", checklist curto e o botão "Abrir requerimento na ANPD (gov.br)".
   - Abaixo, o texto da notificação recolhido ("Ver a notificação enviada") e a lista "Base legal (Lei nº 13.709/2018)" com art. 18, 19, 48 e 55-J em cards pequenos.
   - Rodapé com "Não é assessoria jurídica."

REGRAS DE CONTEÚDO
- Todos os dados são fictícios; nenhum nome, CPF ou e-mail real.
- Nunca mostre o conteúdo de um dado vazado (senha, número completo de CPF ou cartão).
- Não escreva "100% seguro" nem "zero-knowledge".
```

## Segundo prompt: versão celular

```text
Agora gere as mesmas quatro telas em versão celular (390 px de largura): navegação em barra inferior com "Painel" e "Copiloto", cards empilhados, as três fases do plano em abas ou acordeão, e o botão "Entrar como demo" fixo no fim da landing. Mantenha a identidade visual, os textos em português do Brasil e as mesmas regras de conteúdo.
```

## Dicas

- **Uma tela de cada vez:** se o Stitch simplificar demais, peça uma tela por vez ("gere só a tela 4, Plano de resposta").
- **Paleta final:** depois que escolhermos o logo, troque as cores do bloco "Identidade visual" pela paleta final.
- **Exportar:** dá para levar o resultado ao Figma ou exportar o HTML, para comparar com o app real.
