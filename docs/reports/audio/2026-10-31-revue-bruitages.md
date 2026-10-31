# Revue des bruitages — 2026-10-31

Objet : les bruitages (BACKLOG 6.8 et 7.6, ASSETS §6, GDD §11) sonnent « jeu vidéo synthétique » plutôt que réalistes, d'après le retour de l'utilisateur. Source revue : `src/render/sfx.ts` au commit `446256b`, soit 40 effets et la pluie.

## 1. Diagnostic général (avant)

| Défaut | Effet à l'oreille | Effets touchés |
|---|---|---|
| **Oscillateurs nus** (sinus, carré, dent de scie) sans filtre de timbre | « bip » électronique, jamais un objet ni une voix | hurt, refused, pig, roar, swarm, horn, creak, falcon, death |
| **Pas de transitoire** : chaque son démarre sur une rampe de 3 à 5 ms | coups mous, sans « claquement » d'impact | bow, thud, sword, mace, stone, wood, chomp, explosions |
| **Un seul bruit blanc** filtré en passe-bande | souffle uniforme, sans corps grave ni grain | explosions, fire, splash, thunder, collapse |
| **Aucune réverbération** | sons « collés à l'oreille », sans espace ; explosions et tonnerre sans écho | tous |
| **Aucune variation d'une lecture à l'autre** (hauteur, volume) | la même flèche répétée vingt fois trahit la machine | tous les effets répétés : bow, thud, hurt, explosions |
| **Couches trop peu nombreuses** (deux au plus) et enveloppes trop propres | sons « dessinés » : pas de débris, pas de crépitement, pas de queue | explosions, fire, collapse, splash |
| **Métal joué comme des sinus accordés** | l'épée sonne comme une clochette de menu | sword, clink, bell |
| **Pas de bruitage de déplacement** | les combattants marchent, sautent et retombent en silence | (manquants) |

## 2. Par effet : diagnostic et correction appliquée

| Effet | Avant | Correction (route a, appliquée) |
|---|---|---|
| bow | triangle 220 → 150 Hz et souffle | claquement de corde (transitoire), vibration grave de l'arc (118 Hz et son harmonique), sifflement de la flèche qui s'éloigne (bruit rose) |
| crossbow | souffle aigu et triangle | déclic métallique du loquet, choc lourd de l'arbrier, sifflement court |
| sling | un souffle montant | trois tournoiements de plus en plus rapides, puis le lâcher |
| throw | un souffle | petit « han » vocal et un souffle |
| thud | passe-bas et sinus | transitoire, corps de bruit brun, sinus grave, terre projetée (taps dispersés) |
| explosions S, M, L | bruit passe-bas, sinus 90 → 32 Hz, un peu d'aigu | sept couches : claquement, coup dans la poitrine (140 → 34 Hz), souffle d'air (bruit brun), grain (bruit rose), grondement long, éclats et pierres qui retombent ; forte part de réverbération |
| fire | un souffle passe-bande | embrasement (« whoomph »), ronflement tenu, crépitement de braises |
| sword | souffle aigu et deux sinus | balayage d'air, puis choc de lame : partiels inharmoniques d'une barre d'acier (1 ; 2,76 ; 5,4 ; 8,93) |
| mace | sinus grave et souffle | balayage lourd, coup sourd, résonance étouffée de la tête de fer, mailles qui tintent |
| charge | quatre sinus | quatre pas en mailles, choc de l'écu (bois) et coup au corps |
| hurt | carré 330 → 190 Hz (un bip) | coup sur le corps et mailles, puis un « ouf » vocal (voix à formants) |
| death | sifflet à coulisse | même sifflet (choix burlesque gardé), avec vibrato, souffle et chute du corps au sol |
| splash | souffle et sinus | gifle sur l'eau, gerbe d'écume, bulles (glissandos montants), gouttes qui retombent |
| thunder | trois bruits | déchirement crépitant, trois roulements en bruit brun qui s'éloignent, réverbération forte |
| stone, collapse | bruits passe-bande réguliers | chocs de pierre (transitoire, corps, grain), blocs tombant au hasard, poussière |
| wood | deux triangles | deux coups creux à partiels de bois (1 ; 2,3 ; 4,1) |
| roar, pig, swarm, falcon, creak, horn, choir, squeak | oscillateurs nus | voix à formants (gorge du dragon, grouin du cochon, ailes d'abeilles, cri du faucon, bois qui grince par frottement, cor, « aah » du chœur) |
| chomp, flap, dig, clink, bell | taps ou sinus | transitoires, souffles d'aile graves, pelle qui mord la terre, partiels de cloche |
| **step, jump, land** (nouveaux) | — | pas sur l'herbe, « hop » et froissement, réception lourde avec mailles |
| sparkle, chime, pickup, heal, fanfare, click, refused | signaux musicaux ou d'interface | inchangés (volontairement synthétiques), sans variation de hauteur |

Moyens communs ajoutés à `Kit` : bruits blanc, rose et brun ; `crack` (transitoire de quelques ms) ; `scatter` (débris, braises, gouttes) ; `ring` (partiels d'un corps frappé) ; `voice` (dent de scie et formants) ; vibrato ; palier (`hold`) dans l'enveloppe. Chaque lecture varie de ± 1,2 demi-ton et ± 15 % de volume, sauf les effets accordés. Une réverbération d'extérieur (réponse impulsionnelle générée, 1,6 s, assombrie dans la queue, quatre premières réflexions) reçoit une part propre à chaque effet : 0 pour l'interface, 0,4 pour la grosse explosion.

**Reste à brancher** (hors du périmètre de ce lot, dans `battle-scene.ts`) : `step` à chaque pas du combattant actif (le compteur de pas existe déjà), `jump` quand il quitte le sol et `land` quand il le retrouve. Le sim n'émet pas d'événement pour cela : le rendu le lit dans `unit.grounded`, sans rien écrire dans l'état.

## 3. Deux routes comparées

| | (a) Meilleure synthèse Web Audio (faite) | (b) Échantillons enregistrés CC0 |
|---|---|---|
| Réalisme | Nettement meilleur qu'avant pour les impacts, l'eau, le feu et les explosions ; reste stylisé pour les voix et le métal | Le meilleur possible : vrais arcs, vraies épées, vraies voix |
| Téléchargement | 0 octet | Environ 40 effets × 3 variantes × 0,7 s en `.ogg` mono, qualité 4 : **1 à 2 Mo**, plus le préchargement (à étaler après l'écran titre) |
| Licences | Aucune | Une ligne par fichier dans `assets/LICENSES.md` (`.claude/rules/assets.md`) : Freesound filtré sur CC0, ou Sonniss GDC (libre de droits, sans attribution, redistribution interdite hors du jeu) ; vérifier chaque fichier |
| Variation | Infinie (chaque lecture est recalculée) | Trois variantes plus une hauteur aléatoire, suffisant |
| Cohérence avec le ton burlesque | Facile : le sifflet à coulisse et les grognements se règlent dans le code | Il faut trouver ou enregistrer les gags (sifflet, couinements) |
| Coût CPU | Jusqu'à une quarantaine de nœuds par explosion : négligeable sur PC, à surveiller sur tablette lors des rafales (`MAX_PER_FRAME` = 6 limite déjà) | Un `AudioBufferSourceNode` par son : minimal |
| Travail | Fait pour l'essentiel ; réglage à l'oreille | Chercher, trier, découper et normaliser environ 120 fichiers, ajouter un chargeur et un repli sur la synthèse |

## 4. Recommandation

1. **Garder la route (a)**, livrée ici, et la régler à l'oreille dans ⚙ Réglages › Bruitages (chaque effet a son bouton).
2. **Passer en (b) seulement pour les sons que la synthèse ne rend pas** : voix (« ouf », cris), lame d'acier, corde d'arc. Une dizaine de fichiers CC0 au plus (≈ 150 Ko), chargés après l'écran titre, la synthèse restant le repli tant qu'ils ne sont pas chargés. Ce mélange garde l'ambition « zéro fichier » pour 75 % des effets, sans payer le coût d'une banque complète.
3. Brancher `step`, `jump` et `land`, puis refaire une écoute en partie réelle : un réalisme mesuré en jeu, pas bouton par bouton.

## 5. Vérifications

`pnpm run lint`, `pnpm run typecheck` et `pnpm test` (458 tests) sont verts. **L'écoute n'a pas été évaluée** : aucun navigateur n'a été lancé pendant ce lot (une mesure de fps était en cours), donc NOT ASSESSED à l'oreille.
