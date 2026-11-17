# Vespera: Eclipse Carmesim (`crimson-vesper`)

> *"Sete badaladas anunciaram o fim da alvorada. Sete cálices beberam o sangue do Sol. Agora, na noite que não conhece amanhã, apenas a cinza ainda queima."*

Action roguelite *bullet heaven* 2D gótico inspirado em **Vampire Survivors**, construído com **Phaser 3 (WebGL)** e **TypeScript (Vite)**.

🔗 **Repositório:** [github.com/Ald3b4r4n/crimson-vesper](https://github.com/Ald3b4r4n/crimson-vesper)  
📖 **Lore & Grimório Completo:** [docs/lore.md](docs/lore.md)

---

## Destaques de Jogabilidade & Animação

- **Engine Phaser 3 WebGL**: Renderização fluida a 60 FPS com câmera suavizada (*look-ahead*), vinheta pós-processada, neblina volumétrica em camadas e transição progressiva de iluminação conforme o Eclipse avança.
- **Animações e Transições Elegantes**:
  - **Heróis**: Capas esvoaçantes multi-frame, inclinação dinâmica de corrida, respiração em repouso, poeira nos passos e **Passo Espectral (`Espaço`)** com rastros fantasmas luminosos.
  - **Inimigos e Hordas**: Surgimento suave emergindo das sombras no solo (sem *pop-in* brusco), separação espacial via `SpatialGrid`, flash branco + *squash & stretch* elástico ao sofrer dano, números de dano flutuantes e **dissolução em brasas e almas** na morte.
  - **Gemas de Éter & Relicários**: Coleta magnética com curva de recuo clássica e progressão harmônica sonora no Web Audio.
- **3 Juramentados Jogáveis**:
  - **Alaric Belmont** (*Açoite Consagrado*)
  - **Seraphina de Noctis** (*Cetro de Estilhaços*)
  - **Sor Kaelen** (*Machado do Carrasco*)
- **6 Armas Sagradas + 6 Relíquias Passivas + 6 Evoluções Ancestrais** desbloqueadas em Relicários Dourados deixados pelos Senhores do Eclipse (*Fenrir da Lua Podre*, *Cardeal Malakor* e *O Ceifador Carmesim*).

---

## Controles

- **Mover:** `WASD`, `Setas` ou Joystick Virtual (Toque/Mouse)
- **Passo Espectral (Dash Invulnerável):** `Espaço` ou botão `PASSO`
- **Escolher Upgrade Rápido:** `1`, `2`, `3` ou clique nas cartas
- **Pausar:** `Esc` ou `P`

---

## Como Executar e Validar

Requer **Node.js 24+**:

```bash
npm install
npm run dev
```

Validação completa (TypeScript, ESLint, Testes Unitários e Build de Produção):

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
