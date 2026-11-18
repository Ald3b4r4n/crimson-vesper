# Vespera: Eclipse Carmesim (`crimson-vesper`)

> *"Sete badaladas anunciaram o fim da alvorada. Sete cálices beberam o sangue do Sol. Agora, na noite que não conhece amanhã, apenas a cinza ainda queima."*

Action roguelite *bullet heaven* 2D gótico inspirado em **Vampire Survivors**, construído com **Phaser 3 (WebGL)** e **TypeScript (Vite)** — totalmente responsivo para **Celulares (Retrato e Paisagem)** e **PC**.

🔗 **Jogar Online (GitHub Pages):** [ald3b4r4n.github.io/crimson-vesper](https://ald3b4r4n.github.io/crimson-vesper/)  
📦 **Repositório:** [github.com/Ald3b4r4n/crimson-vesper](https://github.com/Ald3b4r4n/crimson-vesper)  
📜 **Lore & Atlas das 7 Fases:** [docs/lore.md](docs/lore.md)  
✦ **Catálogo Completo dos 27 Poderes:** [docs/poderes.md](docs/poderes.md)

---

## Destaques

- **Página de Introdução Ilustrada**: Arte dark-fantasy gótica panorâmica (`public/art/intro-cover.jpg`), retratos pintados dos **4 Juramentados**, seletor ilustrado das **7 Fases**, aba interativa de **Lista de Poderes (27)** e **Grimório & Lore**.
- **7 Fases Distintas**:
  1. **Fase I — Floresta dos Lamentos** *(Floresta Amaldiçoada)*
  2. **Fase II — Castelo Assombrado de Valen** *(Castelo Abandonado Assombrado)*
  3. **Fase III — Masmorras da Inquisição** *(Masmorra Subterrânea)*
  4. **Fase IV — Deserto das Crateras Rubras** *(Deserto com Vulcões e Lava)*
  5. **Fase V — Metrópole Devastada de Solaris** *(Metrópole Medieval em Chamas)*
  6. **Fase VI — Templo Profanado de Alabastro** *(Catedral Religiosa Dessecrada)*
  7. **Fase VII — O Inferno Rubro** *(Nono Círculo Abissal)*
- **Personagens e Inimigos Aprimorados**: 4 heróis com ciclos de 6 quadros, capas esvoaçantes, armaduras detalhadas e armas relíquia; 13 espécies de inimigos + 7 Chefes Guardiões colossais com transições suaves de surgimento, impacto elástico e dissolução em brasas.
- **100% Responsivo para Celulares**: Layout adaptativo com `100dvh` e *safe-area*, joystick analógico flutuante dinâmico ao tocar em qualquer ponto da arena e botão dedicado de **Passo Espectral**.

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
