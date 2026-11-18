# Vespera: Eclipse Carmesim (`crimson-vesper`)

> *"Sete badaladas anunciaram o fim da alvorada. Sete cálices beberam o sangue do Sol. Agora, na noite que não conhece amanhã, apenas a cinza ainda queima."*

Action roguelite *bullet heaven* 2D gótico inspirado em **Vampire Survivors**, construído com **Phaser 3 (WebGL)** e **TypeScript (Vite)** — totalmente responsivo para **Celulares (Retrato e Paisagem)** e **PC**.

🔗 **Jogar Online (GitHub Pages):** [ald3b4r4n.github.io/crimson-vesper](https://ald3b4r4n.github.io/crimson-vesper/)  
📦 **Repositório:** [github.com/Ald3b4r4n/crimson-vesper](https://github.com/Ald3b4r4n/crimson-vesper)  
📜 **Lore & Atlas das 7 Fases:** [docs/lore.md](docs/lore.md)  
✦ **Catálogo Completo dos 27 Poderes:** [docs/poderes.md](docs/poderes.md)

---

## Destaques

- **Menu Inicial com Cara de Game**: Tela inicial dedicada com brasas flutuantes, trilha gótica orquestral, seletor de **4 Juramentados** com pedestal animado do sprite, seletor cinematográfico das **7 Regiões**, **Grade de Poderes & Matriz de Sinergia (`9×3`)** e **Grimório & Lore**.
- **Seletor de Dificuldade (4 Modos)**: `Normal`, `Hard`, `Epic` e **`HOLI SHIT!`** — ajustando vida dos inimigos, tamanho máximo das hordas, taxa de surgimento, Elites, recompensas de almas e escassez de cura pelo cenário.
- **36 Poderes com Ícones Ilustrados (`public/art/icons/*.webp`) & Evoluções Ultimate 👑**: Além das **9 Armas Base**, **9 Relíquias Passivas** e **9 Evoluções Ancestrais ★**, as armas evoluídas avançam até o Grau 3 para despertar sua **9ª Forma Ultimate 👑** suprema em combate.
- **Motor Físico de Chamas & Floresta Densa**: Fogueiras de braseiros, candelabros, poças de fogo alquímico/Gehenna e inimigos em combustão renderizam línguas de fogo com empuxo térmico, arrasto, turbulência e deslocamento de ar ao passar pelo herói/projéteis. A **Fase I (Floresta dos Lamentos)** conta com 72 árvores/ruínas e 135 conjuntos de vegetação interativa.
- **27 Espécies Únicas (20 Inimigos Regulares + 7 Chefes)**: Incluindo Feras Licantropas, Necromantes invocadores, Gárgulas de Obsidiana, Aracnídeos de Ossos, Espectros da Fornalha, Altos Inquisidores e Vermes Abissais, com hordas contínuas e cercos periódicos que crescem a cada minuto dos 40 minutos.
- **Modo Mobile em Tela Cheia Deitada & Campo de Visão Tático**: Campo de visão mínimo de `860` unidades em telas compactas, *multitouch* simultâneo para o **Passo Espectral**, *viewport-fit=cover* e fallback CSS de paisagem.
- **Trilha Sonora Sinfônica Gótica (`src/audio/GothicSoundtrack.ts`)**: Sequenciador polifônico Web Audio com reverberação de catedral, cravo barroco, órgão de tubos, violoncelo em *ostinato*, violino solo e tímpanos de guerra — com temas dinâmicos para Menu, Floresta/ ermos, Catedrais/Masmorras, Inferno e Chefes.
- **7 Fases Distintas**:
  1. **Fase I — Floresta dos Lamentos** *(Floresta Amaldiçoada)*
  2. **Fase II — Castelo Assombrado de Valen** *(Castelo Abandonado Assombrado)*
  3. **Fase III — Masmorras da Inquisição** *(Masmorra Subterrânea)*
  4. **Fase IV — Deserto das Crateras Rubras** *(Deserto com Vulcões e Lava)*
  5. **Fase V — Metrópole Devastada de Solaris** *(Metrópole Medieval em Chamas)*
  6. **Fase VI — Templo Profanado de Alabastro** *(Catedral Religiosa Dessecrada)*
  7. **Fase VII — O Inferno Rubro** *(Nono Círculo Abissal)*
- **Personagens Articulados, Vegetação, Ruínas e Quebráveis**: 4 heróis e 20 criaturas/chefes com animação de membros articulados (8 quadros de passada + 4 de ataque), vegetação reativa ao vento, ruínas com ordenação em Y e objetos destrutíveis (urnas, barris, braseiros) que soltam Cálices de Sangue e Ímãs Astrais.
- **Modo Mobile Tela Cheia Deitada (Paisagem)**: Botão dedicado `⛶ Tela Cheia (Deitada)` (e ativação automática ao jogar no celular) usando Fullscreen API + `screen.orientation.lock('landscape')` com *fallback* automático em rotação CSS horizontal e remapeamento de coordenadas do joystick flutuante para iOS/Android.

---

## Como Executar e Validar

```bash
npm install
npm run dev
```

Validação completa:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
