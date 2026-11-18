# Lista Completa de Poderes, Relíquias, Evoluções e Ultimates (`Vespera: Eclipse Carmesim`)

Este guia resume todos os **36 Poderes** atualmente no jogo (**9 Armas Sagradas**, **9 Relíquias Passivas**, **9 Evoluções Ancestrais ★** e **9 Evoluções Ultimate 👑**), além da habilidade ativa universal de esquiva.

---

## 1. Habilidade Ativa Universal (Todos os Heróis)
- **Passo Espectral (`Espaço` ou botão `PASSO ESPECTRAL` com suporte a dois polegares simultâneos):** Deslize rápido invulnerável que atravessa a horda deixando rastros astrais, empurra inimigos próximos e interage com a física das chamas.

---

## 2. Armas Sagradas (9), Evoluções Ancestrais (9) e Ultimates (9)

> **Regra de Evolução & Ultimate (Partidas de 40 Minutos):**
> 1. **Evolução Ancestral ★:** Suba a **Arma Base até o Grau 5**, tenha **Grau 1+ da Relíquia Catalisadora** e colete um **Relicário Dourado**.
> 2. **Evolução Ultimate 👑:** Evolua a arma **Ancestral ★ até o Grau 3**, tenha **Grau 2+ da Relíquia Catalisadora** e desperte a forma suprema na seleção de nível ou em um Relicário Dourado!

| # | Arma Base (Nv. 1–5) | Relíquia Catalisadora | Evolução Ancestral ★ (Nv. 1–3) | Evolução Ultimate 👑 | Poder Ultimate |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Açoite Consagrado** (`whip`) | **Coração Negro** | **Rosa Sangrenta** (`blood_rose`) | **Leviatã Abissal** (`abyssal_leviathan`) | 4 cortes transversais titânicos com crítico garantido e alta drenagem de vida. |
| **2** | **Cetro de Estilhaços** (`wand`) | **Tomo Vazio** | **Torrente Estelar** (`star_torrent`) | **Cajado Supernova** (`supernova_staff`) | Raios estelares triplos contínuos que detonam em supernovas AoE ao atingir. |
| **3** | **Bíblia das Cinzas** (`bible`) | **Selo de Âmbar** | **Véspera Imortal** (`immortal_vesper`) | **Coro dos Serafins** (`seraphim_choir`) | Duas órbitas contra-rotatórias eternas com 10 escrituras angelicais solares. |
| **4** | **Machado do Carrasco** (`axe`) | **Candelabro Rubro** | **Foice do Eclipse** (`eclipse_scythe`) | **Guilhotina do Juízo** (`doomsday_guillotine`) | Anel de 8 guilhotinas lunares gigantes com perfuração ilimitada. |
| **5** | **Turíbulo Sagrado** (`thurible`) | **Sangue de Mercúrio** | **Mortalha Devoradora** (`devouring_shroud`) | **Eclipse Carmesim Vivo** (`crimson_eclipse_aura`) | Domínio colossal que incinera a horda com chamas físicas e drena vitalidade. |
| **6** | **Anel do Trovão Rubro** (`lightning`) | **Anel Duplicador** | **Julgamento dos Sete** (`seven_judgment`) | **Ira de Solaris** (`wrath_of_solaris`) | Tempestade contínua de pilares de trovão e plasma solar com grande área crítica. |
| **7** | **Adagas Fantasmas** (`daggers`) | **Manopla da Sombra** | **Mil Presas de Prata** (`thousand_fangs`) | **Tempestade Espectral** (`phantom_storm`) | Salvas supersônicas de 7 adagas prateadas perfurantes com crítico letal. |
| **8** | **Fogo Alquímico Bento** (`flask`) | **Orbe do Crepúsculo** | **Maré Purificadora** (`purifying_tide`) | **Inferno de Gehenna** (`gehenna_inferno`) | Vórtices infernais perseguidores com línguas de fogo físicas e combustão em área. |
| **9** | **Cruz do Julgamento** (`cross`) | **Trevo de Cinza** | **Espada Celestial** (`celestial_blade`) | **Excalibur do Zênite** (`excalibur_zenith`) | Constelação giratória 360° de 5 gládios solares em bumerangue de crítico absoluto. |

---

## 3. Relíquias Passivas (9)

| Relíquia Passiva | Efeito por Nível | Nível Máx. | Sinergia de Evolução |
| :--- | :--- | :---: | :--- |
| **Coração Negro** (`black_heart`) | `+20% Vida Máxima` + cura imediata de `20 HP` | 5 | Açoite Consagrado |
| **Tomo Vazio** (`empty_tome`) | `-8% Tempo de Recarga` global das armas | 5 | Cetro de Estilhaços |
| **Selo de Âmbar** (`amber_seal`) | `+12% Dano Global` e `+5% Velocidade de Movimento` | 5 | Bíblia das Cinzas |
| **Candelabro Rubro** (`crimson_candelabra`) | `+14% Área de Ataque` e tamanho dos efeitos | 5 | Machado do Carrasco |
| **Sangue de Mercúrio** (`mercury_blood`) | `+0.8 HP/s Regeneração`, `+1 Armadura` e `+20% Ímã` | 5 | Turíbulo Sagrado |
| **Anel Duplicador** (`duplicator_ring`) | `+1 Projétil adicional` para todas as armas aplicáveis | 3 | Anel do Trovão Rubro |
| **Manopla da Sombra** (`assassin_gauntlet`) **[NOVO]** | `+15% Velocidade de Projétil` e `+6% Chance Crítica` | 5 | Adagas Fantasmas |
| **Orbe do Crepúsculo** (`twilight_orb`) **[NOVO]** | `+10% Área Global` e `+10% Poder de Dano` | 5 | Fogo Alquímico Bento |
| **Trevo de Cinza** (`ash_clover`) **[NOVO]** | `+8% Chance Crítica` e `+15% Raio de Coleta` | 5 | Cruz do Julgamento |

---

## 4. Arquitetura Modular para Criar Novos Poderes Facilmente

Quando quiser criar um novo poder (ex.: *Corvos Necromânticos*, *Lança de Gelo*, *Escudo Espelhado*, *Meteoro Abissal*), a estrutura foi organizada em 3 pontos simples:
1. **`src/data/loreData.ts`**: Adicionar o ID em `BaseWeaponId` / `EvolvedWeaponId` / `RelicId` e preencher nome, ícone, cor e textos dos 5 níveis em `WEAPONS` / `RELICS`.
2. **`src/game/UpgradeLogic.ts`**: Incluir o ID em `ALL_BASE_WEAPONS` / `ALL_RELICS` (a geração de cartas e checagem de evolução nos baús já funciona automaticamente!).
3. **`src/scenes/ArenaScene.ts` + `src/art/SpriteForge.ts`**: Desenhar a textura do projétil/efeito em `SpriteForge.ts` e adicionar o disparo no `updateWeapons()` de `ArenaScene.ts`.
