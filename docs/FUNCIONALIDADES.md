# Olharium: funcionalidades e o que fecha a demo

Checklist simplificado para a dupla. Atualizado em 25/11/2026.

**Legenda:**
- ✅ **pronto e testado**
- 🟡 **pronto com ressalva** (só testado com simulação, ou depende de uma chave ou de um teste de vocês)
- ⬜ **planejado, ainda não feito**
- ➖ **fora do MVP**

> Tudo o que está ✅ funciona no código e nos testes. Vai para a demo no ar ([radar360-web.vercel.app](https://radar360-web.vercel.app)) no próximo deploy.

## 1. Entrada e demo

- [x] ✅ Landing com o botão **"Entrar como demo"** (persona fictícia, sem cadastro)
- [x] ✅ Cada sessão demo é isolada: os incidentes e as contas de um jurado somem com a sessão (2 h)
- [x] ✅ Identidade visual **HUD Neon**: logo, favicon, tema escuro e design system (`docs/design-system.md`)
- [ ] ⬜ Cadastro real, com e-mail confirmado por link

## 2. Vazamentos: "o que vazou de quem eu sou e do que eu uso"

- [x] ✅ **Vazamentos reais** do catálogo público do Have I Been Pwned: 872 verificados, 7 de empresas brasileiras. São só metadados (empresa, data, o que vazou, contas afetadas), nunca dado pessoal.
- [x] ✅ **Minhas contas:**
  - buscar, adicionar e remover os serviços que você usa;
  - marcar "tem verificação em duas etapas" e "mexe com dinheiro";
  - ver os vazamentos reais de cada serviço e abrir o plano de resposta.
- [x] ✅ Motor de cruzamento por **HMAC** de e-mail, CPF e telefone, com deduplicação. Na demo ele roda sobre uma base fictícia, por regra do regulamento.
- [x] ✅ **Score de exposição** de 0 a 100, com fórmula fixa explicada na tela
- [x] 🟡 Atualização automática do catálogo e do cruzamento a cada 6 h (GitHub Actions). Falta o Matheus criar os dois secrets no GitHub.
- [ ] ⬜ Alerta por e-mail quando surgir vazamento novo (Resend)
- [ ] ⬜ Busca do **seu e-mail** no Have I Been Pwned (API paga; ideia para a final)

## 3. Copiloto de incidentes: "o que eu faço agora"

- [x] ✅ **Relato livre** ("caí num golpe do Pix") vira um plano de **15 min, 1 h e 24 h** com links oficiais. Cobre golpe do Pix, celular roubado, conta invadida, link falso e conta aberta no seu nome.
- [x] ✅ CPF, cartão, telefone, e-mail e chave Pix são apagados do relato antes de salvar e antes da IA
- [x] ✅ **Plano de resposta de vazamento,** fictício ou real, aberto a partir do painel ou de "Minhas contas"
- [x] ✅ **"Uma empresa avisou que vazou meus dados"** vira um plano com a notificação LGPD pronta
- [x] ✅ **Notificação LGPD** ao encarregado: o app conta o prazo de 15 dias e, sem resposta, entrega a **petição à ANPD** pronta, com o passo a passo no gov.br
- [x] ✅ Playbook **"celular roubado"** (Celular Seguro, bancos, operadora, IMEI, boletim de ocorrência)
- [x] 🟡 Classificação do relato pela IA (Gemini): o código está pronto, mas sem chave a classificação é feita por palavras-chave, que já funcionam
- [ ] ⬜ Lembrete do prazo de 15 dias na agenda (`.ics`) e texto pronto do pedido de devolução do Pix (MED) ao banco

## 4. Agente local: "proteger e corrigir o meu computador e a minha rede"

- [x] ✅ **Auditoria da rede de casa:** pede consentimento, só roda em rede privada (no máximo 254 endereços) e nunca tenta senhas
- [x] ✅ **Auditoria em Wi-Fi público:** olha só o seu computador (firewall, portas, perfil de rede, Wi-Fi, ARP) e não envia nada a outros aparelhos
- [x] 🟡 **Correções com o seu OK**, uma de cada vez e com "desfazer" (`--corrigir`, `--simular`, `--desfazer`):
  - liga o firewall;
  - passa o Wi-Fi para o perfil Público;
  - desliga o compartilhamento de arquivos e a Área de Trabalho Remota;
  - bloqueia uma porta exposta;
  - **fecha portas abertas para a internet no roteador (UPnP)**.

  Tem 138 testes com simulação, mas **ainda não foi rodado de verdade**. Testem num PC e num roteador de vocês antes do vídeo.
- [x] ✅ O painel mostra **"Corrigido pelo agente, com o seu OK"** (na demo, com correções fictícias da persona)
- [x] 🟡 Envio da auditoria para a API de produção: funciona localmente, mas ainda não foi testado com o token de produção
- [ ] ⬜ Modo vigia: avisar ao conectar num Wi-Fi aberto

## 5. Plataforma e segurança

- [x] ✅ No ar a custo zero: Vercel (site e API, em São Paulo) e Neon (banco, em São Paulo)
- [x] ✅ Limites de uso por visitante e teto de chamadas à IA
- [x] ✅ Nunca mostra o dado vazado, nunca pede senha, e todos os textos jurídicos levam "não é assessoria jurídica"
- [x] ✅ Testes passando: 83 na API e 138 no agente, além de typecheck, lint e build

## 6. Fora do MVP

- ➖ App de celular ou PWA
- ➖ Leitura dos apps instalados
- ➖ Apagar o celular à distância
- ➖ Varrer redes de terceiros
- ➖ Open Finance
- ➖ Treinar um modelo de IA
- ⬜ Leitura de termos de uso (versão leve): só se sobrar tempo

## 7. Para fechar a demo (até 30/11)

- [ ] Deploy desta versão (marca nova, Minhas contas, empresa avisou, correções) e a migração do banco de produção
- [ ] Criar os secrets `RADAR_API_URL` e `RADAR_JOBS_SECRET` no GitHub (Matheus)
- [ ] Rodar o agente com `--corrigir` num PC e num roteador de vocês e gravar para o vídeo
- [ ] Vídeo de até 3 min, roteiro em `docs/plano-de-valor.md`:
  1. entrar como demo;
  2. Minhas contas com vazamento real;
  3. plano e notificação LGPD;
  4. relato de golpe do Pix;
  5. o agente corrigindo.
- [ ] Nome, frase curta e descrição da submissão
- [ ] Enviar uma versão de garantia assim que o vídeo existir, e a final até a tarde de 30/11
- [ ] Nenhum commit depois de 30/11
