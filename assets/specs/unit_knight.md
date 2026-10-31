# unit_knight — Chevalier
Priorité : P0 · Source : ASSETS §3.1–3.5, §9 · GDD §3.2

## Rôle en jeu
Le combattant lourd : haubert intégral, heaume, écu armorié. Le joueur doit lire d'un coup d'œil, à 80 px de haut, que c'est le plus protégé (beaucoup de fer gris) et à quelle maison il appartient (cotte et écu aux couleurs de la maison).

## Livrables
Le rig est figé ([ADR 0003](../../docs/adr/0003-cutout-rig-format.md)) : `src/content/rigs/knight/rig.json` fait foi. Tailles et pivots en px ×1, à produire en ×2 (figure de 176 px de haut, ASSETS §2). La figure, de 80 px de haut à ×1, tient en 2,8 têtes environ : le heaume fait 29 px, le cou est à 57 px du sol, la taille à 40, les hanches à 24 et les genoux à 13.

| Fichier | Taille ×1 (×2) | Pivot ×1 | Tintable | Notes |
|---|---|---|---|---|
| `unit_knight_helm_01` | 26 × 29 (52 × 58) | 12, 25 | — | heaume à sommet plat, croix d'or, fente des yeux |
| `unit_knight_neck` | 13 × 10 | 5, 21 | — | camail de mailles |
| `unit_knight_torso_tint` | 38 × 49 | 19, 24 | champ | cotte d'armes sur le haubert, plis tubulaires |
| `unit_knight_belt_tint` | 26 × 8 | 13, 6 | seconde | ceinture |
| `unit_knight_buckle` | 8 × 8 | −1, 6 | — | boucle d'or |
| `unit_knight_shield_tint` | 22 × 39 | 12, 13 | champ | écu en amande, champ uni |
| `unit_knight_shield_charge_tint` | 18 × 19 | 10, 0 | seconde | meuble (chevron), zone du blason du 6.2 |
| `unit_knight_arm_{near,far}_upper` | 17 × 21–22 | voir rig.json | — | manche de mailles |
| `unit_knight_arm_{near,far}_lower` | 12–18 × 19–20 | 6, 6 | — | avant-bras de mailles |
| `unit_knight_hand_{near,far}` | 11 × 10–11 | voir rig.json | — | gant de mailles |
| `unit_knight_thigh_{near,far}` | 14 × 25 | 7, 8 | — | chausses de mailles |
| `unit_knight_shin_{near,far}` | 12 × 20 | 6, 6 | — | chausses de mailles |
| `unit_knight_foot_{near,far}` | 16 × 7 | 5, 2 | — | soulier de cuir pointu, Terre d'ombre `#6b4a2e` |
| `weapon_bow_held`, `weapon_stone_held` | 34 × 27, 14 × 13 | voir rig.json | — | partagés par les six classes |

Les pièces `_tint` se peignent en gris neutres (luminosité de 50 à 85 %) : le jeu les multiplie par les couleurs de la maison.

## Style
Aplats, cerne d'Encre `#2a1d14` de 3 px à ×1 (2 px pour les détails), modelé par une ou deux nuances posées en traits, sans dégradé ni perspective. Mailles en petits arcs répétés : Fer `#a7a4a6`, fer à l'ombre `#8a8789`, heaume `#bdb9b0`. Or `#d4a93c` pour la croix du heaume et la boucle. Carnation `#f0cfb0` seulement dans la fente du heaume. Les couleurs de la maison n'apparaissent jamais dans le dessin : les pièces tintables restent grises.

## Prompts de génération (ChatGPT, génération d'images)
Les prompts sont en anglais, la langue que les générateurs suivent le mieux. Joindre `docs/reports/art/knight-ref.png` (le Chevalier SVG actuel, agrandi, pièces de la maison en gris) comme image de référence pour les proportions ; l'arc qu'il tient est une pièce à part, d'où « empty hands ».

### A. Image de comparaison (la belle image, pour trancher entre SVG et génération)
```
Medieval manuscript illumination in the style of the Maciejowski Bible (Paris, c. 1250).
Flat opaque colors, uniform dark brown outlines (#2a1d14), minimal shading with darker
line strokes, no perspective, no gradients, no realistic lighting.
A single comic, stocky knight standing in strict side view facing right, about three heads
tall (large head, short sturdy body), feet slightly apart, arms held a little away from the
body. He wears a full chainmail hauberk drawn as rows of tiny repeated arcs (grey iron),
mail leggings and pointed brown leather shoes, empty mailed hands, a flat-topped great helm with a narrow eye slit and a
small gold cross on the front, a knee-length surcoat with tubular folds and a belt with a
gold buckle, and an almond-shaped shield on his far arm. Surcoat in lapis blue (#2c4a8c),
belt and shield chevron in vermilion (#b8322a), shield field lapis blue.
Calm, slightly pompous bearing, gently burlesque, not grotesque.
Full figure, isolated on a plain white background. No text, no frame, no border, no ground,
no shadow, no other figures.
```

### B. Planche de découpe (si l'image A l'emporte)
Même style, mais la cotte, la ceinture et l'écu en gris neutres pour la teinte, et la figure
dans la pose du rig, pour que la découpe tombe juste.
```
Medieval manuscript illumination in the style of the Maciejowski Bible (Paris, c. 1250).
Flat opaque colors, uniform dark brown outlines (#2a1d14) of constant width, minimal shading
with darker line strokes, no gradients, no perspective.
Character sheet of the same knight in chibi proportions, head as large as the torso, only 3
heads tall, very thick dark outlines (about 1/40 of the figure's height), head in side view
facing right, standing still, legs straight and apart, both feet pointing right, both arms
hanging away from the body, shield held out to the side without covering the arm, so that no
limb overlaps the torso. Full chainmail hauberk drawn as rows of tiny arcs,
flat-topped great helm with eye slit and small gold cross, pointed brown leather shoes, empty mailed hands (no weapon).
IMPORTANT: the surcoat, the belt and the almond-shaped shield are painted ONLY in neutral
light greys (no color at all), with the folds drawn as darker grey strokes; the shield is
plain grey with a slightly darker grey chevron. All other colors: grey iron, gold details.
Exactly one figure, centered, full body, on a pure white background. No text, no frame,
no ground line, no cast shadow.
```

Essai du 2026-10-31 : un premier jet à 6 têtes, en marche, fin cerne aquarellé, était illisible à 80 px. Le second, avec les consignes ci-dessus (chibi, cerne épais, pose neutre, gris), tient à 80 px et se découpe : seul le pied près, tourné vers l'arrière, est à retourner, et les souliers sont à repeindre en Terre d'ombre.

### Négatif / à éviter
Sang, armes brandies, perspective ou trois-quarts, ombres portées, dégradés et éclairage réaliste, texture de parchemin dans le fond, cadre ou lettrine, texte, reproduction d'une miniature précise du manuscrit (ASSETS §1.3), plusieurs personnages, couleurs de maison sur la planche B.

## Procédure
1. Comparer A au Chevalier SVG **à la taille du jeu** (80 et 176 px de haut, zoom 0,5 / 1 / 1,5) et pas seulement en grand : une image générée perd l'essentiel de ses détails à cette échelle.
2. Si l'image générée l'emporte : générer B, garder une seule pose (ASSETS §9.1), la détourer, la découper en 21 pièces sur les rectangles du rig, **repeindre les parties cachées** aux articulations (épaule sous la cotte, haut des cuisses, cou sous le heaume), sinon des trous apparaissent quand les membres tournent.
3. Repasser les cernes à épaisseur constante, quantifier sur la palette §1.2, puis déposer chaque PNG ×2 sous sa clé dans `public/assets/units/knight/` (ajouter ensuite les clés à `src/content/art.json`).
4. Les cinq autres classes reprennent ensuite la planche B du Chevalier comme image de référence, pour garder un même style.

## Animations liées
Toutes empruntées par les six classes (`anims: "knight"`) : `idle` (boucle, 2 s), `walk` (boucle, 0,8 s), `jump_forward`, `jump_back`, `fall`, `land`, `fly_tumble` (boucle, 0,6 s), `hurt` (0,4 s), `aim_bow` / `fire_bow`, `aim_throw` / `fire_throw` (0,3–0,5 s), `death` (1 s, puis stèle). Aucun dessin supplémentaire : seules les pièces tournent.

## Validation
- [ ] Palette respectée (pas plus de 5 % de couleurs hors charte)
- [ ] Cernes conformes à ×1
- [ ] Fond transparent propre, sans halo
- [ ] Pivots aux positions de `rig.json`, aucune fente visible aux articulations pendant `walk` et `fly_tumble`
- [ ] Pièces `_tint` en gris neutres de 50 à 85 %
- [ ] Testé en jeu à zoom 0,5 / 1 / 1,5
- [ ] `python tools/asset_audit.py --scope units`
