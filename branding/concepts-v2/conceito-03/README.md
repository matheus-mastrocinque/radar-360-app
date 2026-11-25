# Conceito 03: HUD Neon

**Olharium, 2ª rodada de marca.**

## A ideia

O olho do Olharium é também o painel de um sistema de defesa. Uma íris carmesim, desenhada com traços de luz, fica no centro de uma mira. Em volta dela há anéis de HUD com graduação, um arco de varredura e pequenos índices técnicos. O fundo é preto profundo e o brilho vermelho é forte. A estética é cyber, mas contida: sem caveira, sem código verde e sem glitch. O alvo é "instrumento de precisão", não "hacker de filme".

Leitura em camadas, de fora para dentro:

1. **Anel de telemetria:** graduação a cada 3° com marcas maiores a cada 15°. Tem três rótulos (`15MIN`, `1H`, `24H`) e duas "asas" de mira no eixo horizontal, que fazem o papel dos cantos do olho.
2. **Anel segmentado:** arcos com terminais e três pips em losango, alinhados aos rótulos. Embaixo fica um medidor de 9 segmentos, 6 deles acesos.
3. **Varredura:** uma cunha translúcida que termina numa linha clara com um ponto branco. É o monitoramento contínuo.
4. **Olho:** halo vermelho, aro luminoso, limbo preto grosso, íris em gradiente radial com fibras luminosas, anel interno fino (a órbita), pupila com retícula diagonal e reflexo especular.
5. **Três fragmentos de dados:** cristais de obsidiana alongados e facetados, com uma aresta incandescente. Cada um deixa um rastro de luz e um eco em wireframe.

## A história das marcas em rotação

Os três fragmentos que giram em volta da pupila são **as três fases da resposta do Olharium**:

| Fragmento | Posição | Fase |
| --- | --- | --- |
| 1 | topo, aponta para `15MIN` | **Agora (até 15 min):** travar o que dá para travar. |
| 2 | baixo à direita, aponta para `1H` | **Primeira hora:** avisar o banco, trocar acessos. |
| 3 | baixo à esquerda, aponta para `24H` | **Próximas 24 h:** notificação LGPD, ANPD, registros. |

Os fragmentos giram no sentido horário, a direção em que o tempo anda. O rastro e o eco atrás de cada um são o tempo passando. Cada fragmento aponta para o seu marcador no anel de fora, ou seja, o painel mostra o prazo de cada fase.

Frase de pitch: *"Três fragmentos, três prazos. O olho gira para você não perder nenhum."*

## Perto no sentimento, longe no desenho

**O que traz a sensação de "olho de anime ativado":**

- íris carmesim intensa com gradiente radial;
- limbo preto grosso;
- anel interno fino onde as marcas orbitam;
- três marcas em simetria rotacional de 120°;
- glow vermelho, reflexo especular e rastro de movimento;
- várias camadas de profundidade.

**Por que não é cópia:**

- **As marcas são losangos alongados e facetados**, com arestas retas e quatro faces de luz e sombra. Nenhuma tem cabeça arredondada nem cauda afinando. Não há vírgula nem gota em lugar nenhum.
- **O rastro foi desenhado para não virar cauda.** É uma faixa de luz de largura constante, em cor clara (o fragmento é preto), que acompanha a órbita e não afina até virar ponta. Atrás dela há um eco destacado em wireframe. Assim o fragmento e o rastro nunca formam uma silhueta única. No favicon, o rastro nem aparece.
- **Não existe nenhum padrão de cata-vento ou de pás curvas.** Os fragmentos ficam tangentes à órbita, não radiais, e não se tocam nem se ligam ao centro.
- **O vocabulário vem de outra fonte:** mira, telemetria, graduação de instrumento, varredura de radar, rótulos de prazo. O olho é lido como painel, não como olho de personagem.
- **Nada de folha, bandana, cicatriz** ou nomes da obra em arquivos e textos.

Teste do brief: quem conhece a referência sente o parentesco (vermelho, anel preto, três marcas girando), mas não consegue apontar qual desenho foi copiado, porque nenhum desenho foi.

## Paleta

| Nome | Hex | Papel |
| --- | --- | --- |
| **Carmesim Vigília** | `#E3123C` | Cor da marca: íris, botão primário, símbolo. |
| **Neon Rubi** | `#FF3B5C` | Luz do HUD, linhas, destaques e **texto vermelho sobre fundo escuro**. |
| **Carmesim Profundo** | `#7A0820` | Sombra da íris, gradientes, hover escuro. |
| **Carmesim Tinta** | `#C8102E` | Variante da marca para fundo claro (anéis do logo claro, losango do "A"). |
| **Obsidiana** | `#07060A` | Fundo principal. |
| **Grafite** | `#15111A` | Superfícies e cartões. Bordas em `#2A2430`. |
| **Névoa** | `#F4F1F3` | Texto principal no escuro e fundo claro. |
| **Cinza Sinal** | `#A69DAA` | Texto secundário no escuro. No claro, use `#5C5462`. |
| **Ciano Telemetria** | `#4FD9E6` | **Acento:** foco de teclado, links de informação, dados "ao vivo". Usado pouco. |
| **Verde Sinal** | `#2FD38A` | Estado: ok, resolvido. |
| **Âmbar Alerta** | `#F5B83D` | Estado: atenção. |
| **Laranja Falha** | `#FF6B2C` | Estado: erro, risco alto. |

**Gradiente Ativação** (íris e destaques):

`#12020A → #7A0820 → #E3123C → #FF3B5C → #FF8FA3`

Use-o em versão radial na íris e linear em barras e cabeçalhos.

### Vermelho da marca ≠ vermelho de erro

O carmesim da marca **não sinaliza estado**. Quatro regras resolvem a confusão:

1. **Matiz diferente.** A marca puxa para o magenta (`#E3123C` tem matiz 348°). O erro puxa para o laranja (`#FF6B2C` tem matiz 18°). São 30° de distância, e o erro fica visivelmente "quente".
2. **Papéis exclusivos.** O carmesim e o Neon Rubi aparecem só no símbolo, no botão principal e nos detalhes de HUD. Erro, risco alto e incidente grave usam sempre Laranja Falha. A escala de risco é Verde Sinal → Âmbar Alerta → Laranja Falha e nunca passa pelo carmesim.
3. **A cor nunca vai sozinha.** Todo erro leva ícone (triângulo com "!") e uma palavra ("Erro", "Risco alto"). Isso também atende quem não distingue vermelho de laranja.
4. **Acabamento diferente.** O vermelho da marca brilha (glow, gradiente). O estado de erro é chapado, sem brilho.

### Contraste WCAG (texto)

| Texto | Fundo | Contraste | Resultado |
| --- | --- | --- | --- |
| Névoa `#F4F1F3` | Obsidiana `#07060A` | 18,0 : 1 | AAA |
| Névoa `#F4F1F3` | Grafite `#15111A` | 16,6 : 1 | AAA |
| Cinza Sinal `#A69DAA` | Obsidiana | 7,7 : 1 | AAA |
| Cinza Sinal `#A69DAA` | Grafite | 7,1 : 1 | AAA |
| Neon Rubi `#FF3B5C` | Obsidiana | 5,8 : 1 | AA |
| Neon Rubi `#FF3B5C` | Grafite | 5,4 : 1 | AA |
| Carmesim Vigília `#E3123C` | Obsidiana | 4,25 : 1 | **Só texto grande** (≥ 24 px ou 18,7 px em negrito). Para texto comum, use Neon Rubi. |
| Branco `#FFFFFF` | Carmesim Vigília | 4,75 : 1 | AA (botão primário) |
| Obsidiana `#07060A` | Neon Rubi | 5,8 : 1 | AA (botão alternativo) |
| Tinta `#0F0B12` | Névoa | 17,4 : 1 | AAA (logo claro) |
| Carmesim Tinta `#C8102E` | Névoa | 5,25 : 1 | AA |
| Cinza `#5C5462` | Névoa | 6,5 : 1 | AA |
| Laranja Falha `#FF6B2C` | Obsidiana | 7,1 : 1 | AAA |
| Laranja Falha `#FF6B2C` | Grafite | 6,6 : 1 | AA |
| Âmbar Alerta `#F5B83D` | Obsidiana | 11,4 : 1 | AAA |
| Verde Sinal `#2FD38A` | Obsidiana | 10,4 : 1 | AAA |
| Ciano Telemetria `#4FD9E6` | Obsidiana | 11,9 : 1 | AAA |

As razões foram calculadas pela fórmula de luminância relativa da WCAG 2.x.

## Tipografia

Todas as fontes são do Google Fonts, com licença OFL.

- **Michroma:** wordmark e títulos curtos em caixa alta. É larga e técnica, com o ar de painel de instrumentos.
  - O wordmark foi **convertido em curvas** com `opentype.js`, a partir do `Michroma-Regular.ttf` do repositório `google/fonts`.
  - Ganhou um contorno de 3,4% do corpo para ficar mais pesado. O espaçamento entre letras é de 0,16 em.
  - **Detalhes próprios:**
    - o **A perde a barra** (vira um Λ) e no lugar dela entra um **fragmento de dados** em carmesim, o mesmo losango assimétrico do símbolo;
    - o **O abre no lado esquerdo**, e a linha de mira que sai do anel do símbolo encaixa nessa abertura. É o "O ligado ao símbolo".
- **IBM Plex Sans:** texto e interface. É legível, tem acentuação completa em português e um tom neutro e confiável.
- **IBM Plex Mono:** telemetria, prazos (`T+15MIN · T+1H · T+24H`), códigos de protocolo e rótulos do painel. Os rótulos de fase do hero também foram convertidos em curvas a partir do `IBMPlexMono-SemiBold.ttf`.

## Slogan

> **Vigia por você. Responde com você.**

São seis palavras. O slogan é honesto com o produto: o Olharium vigia sozinho, mas a resposta é feita *com* a pessoa, com plano e documentos prontos para ela agir. Ele não promete correção automática nem segurança absoluta.

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `hero.svg` | Marca principal, 512 × 512, com todos os detalhes, para fundo escuro. Usa filtros SVG (glow). |
| `icon.svg` | Ícone de app (quadrado arredondado), simplificado a partir do hero, sem filtros. Legível em 32 px. |
| `favicon.svg` | Versão mínima (32 × 32): limbo, íris, pupila e três fragmentos. Legível em 16 px em aba clara e escura. |
| `logo-dark.svg` | Lockup horizontal para fundo escuro, com o wordmark em curvas. |
| `logo-light.svg` | Lockup horizontal para fundo claro, com o wordmark em curvas. |
| `brand-board.html` / `brand-board.png` | Prancha de apresentação (1600 × 1000). |

## Pontos fracos (honestos)

1. **O território do neon cyber já é ocupado.** Muitas marcas de segurança e de games usam HUD vermelho e preto. A diferença está no acabamento e na história das três fases. Se a interface usar HUD em excesso, vira "tema gamer". A dose precisa ser baixa no produto: o HUD cheio fica na marca e na tela de abertura.
2. **O hero depende de filtros SVG** (`feGaussianBlur`). Em Figma, em clientes de e-mail e em renderizadores antigos o brilho pode sumir ou mudar. Para redes sociais e para o pitch, exporte em PNG. O `icon.svg` e o `favicon.svg` não usam filtros.
3. **Os rótulos `15MIN / 1H / 24H` são microtexto.** Abaixo de uns 300 px eles viram textura e a história passa a depender de alguém contar.
4. **O ícone em 32 px vira "olho vermelho com anel".** Os fragmentos quase somem. Para tamanhos pequenos existe o favicon, que é outro desenho.
5. **A referência é forte de propósito.** Íris vermelha, limbo preto e três marcas a 120° lembram o olho de anime à primeira vista. Os losangos facetados e a ausência de qualquer forma com cauda sustentam a originalidade, mas um jurado mais rígido pode achar perto demais. Se for preciso afastar mais, há duas alavancas: tirar o rastro e usar quatro fragmentos.
6. **A Michroma tem um peso só.** O wordmark usa contorno para ganhar peso. Quem digitar "Olharium" em Michroma vai ter um resultado mais fino, então use sempre os SVGs. O lockup também é largo (cerca de 4 : 1) e ainda falta uma versão empilhada para espaços estreitos.
7. **O carmesim da marca não serve para texto pequeno sobre o escuro** (4,25 : 1). A regra é usar o Neon Rubi para isso. É uma regra a mais para o time lembrar.
8. **O tema claro da interface não foi especificado.** Só existe o logo claro e algumas cores de apoio.
