# Projet ChatGPT : les personnages de Medieverse

Ce guide sert à produire, dans ChatGPT, les images des cinq classes qui restent (Archer, Frondeur, Sapeur, Clerc, Roi). Chaque image doit pouvoir être découpée sans retouche par le script du Chevalier ([knight/gen/cut.py](../units/knight/gen/cut.py)).

Les consignes pour ChatGPT sont en anglais : c'est la langue qu'il suit le mieux pour les images. Les explications autour sont en français.

---

## 1. Créer le projet (une seule fois)

1. Dans ChatGPT, ouvrir **Projets → Nouveau projet**, et le nommer « Medieverse — personnages ».
2. **Fichiers du projet** : y déposer `assets/units/knight/gen/knight-source.png`, le Chevalier validé. Il sert de **référence de style**.
3. **Instructions du projet** : coller le bloc ci-dessous tel quel.

```
You are the illustrator of Medieverse, a burlesque turn-based artillery game whose look follows
the Maciejowski Bible (Paris, c. 1250) as a modern cartoon. Every image you make is ONE game
character sheet that will be cut automatically into animated body parts, so these rules are
absolute, in every image, without exception:

STYLE (copy the attached knight-source.png exactly: same hand, same line, same flat colours)
- Flat opaque colours, no gradients, no texture, no realistic lighting, no cast shadow.
- Very thick, even, dark brown outlines (#2a1d14), about 1/40 of the figure's height, around
  every shape and every part; thinner dark lines for folds and details.
- Chibi proportions: head as large as the torso, the figure only about 3 heads tall, short
  sturdy limbs. Burlesque, good-natured, slightly pompous; never grotesque, never gory.
- Mail is drawn as rows of small scales, as on the knight.

CANVAS AND FRAMING
- Portrait canvas 1024 x 1536. Pure white background (#ffffff), nothing else on it: no ground
  line, no shadow, no frame, no border, no text, no white sticker outline round the figure.
- ONE figure only, centred, the whole body visible, never cropped: the top of the head (or of the
  hat/crown) about 25 px below the top edge, the soles about 30 px above the bottom edge, so that
  every character has the same height as the knight.

POSE (the same for every character; it is the rest pose of the animation rig)
- Head seen in profile facing RIGHT; torso in three-quarter view, as on the knight.
- Standing still, legs straight and apart, a clear gap of white between the legs.
- BOTH feet point to the RIGHT.
- Both arms hang down slightly away from the body, with a clear gap of white between each arm
  and the torso; no arm crosses the body, nothing in front of the torso.
- Hands relaxed and EMPTY (fingers together, like mittens), unless the prompt says otherwise.
- The arm on the left of the picture is the arm behind; the arm on the right of the picture is
  the arm in front.

COLOURS THAT THE GAME REPAINTS (house colours)
- Garments marked "house colour" are painted ONLY in plain LIGHT GREY (#cfcfcf), folds in darker
  grey lines. Garments marked "second colour" ONLY in plain MEDIUM GREY (#9a9a9a). Never any hue
  on them: the game tints these greys with each house's heraldic colours.
- Everything else keeps its natural colour: skin (#f0cfb0), mail and iron (light grey with dark
  scale lines), leather and wood (browns #6b4a2e, #8a5a34), gold (#d4a93c), green (#4d7a4a),
  white linen (#f3ecd9).

NEVER
- No weapon or tool in the hands unless asked; no blood; no background scenery; no second
  character; no perspective; no logo or lettering.
```

4. **Réglages de génération** : format **portrait (2:3)**. Une image par conversation. Si une image rate, **régénérer** plutôt que demander une retouche : les retouches successives font dériver le style.

---

## 2. Les prompts, un par image

Coller chaque prompt dans une **nouvelle conversation** du projet, en y joignant `knight-source.png` (glisser l'image dans le message).

### Archer
```
Character sheet: the ARCHER, in the exact style, proportions and pose of the attached knight.
A wiry, eager young archer with a cheerful determined face, almond eyes, small nose.
- Head: a hood (chaperon) with a short shoulder cape whose lower edge is cut in pointed
  dagges, in "second colour" (medium grey); the face shows inside the hood.
- Body: a knee-length tunic with long sleeves in "house colour" (light grey), a narrow brown
  leather belt with a small gold buckle.
- Legs: green hose (#4d7a4a), short brown leather boots, both feet pointing right.
- A brown leather quiver full of arrows (white fletching) on his back, sticking out behind the
  left shoulder of the picture, not overlapping the arms.
- Hands empty, no bow.
```

### Frondeur (Slinger)
```
Character sheet: the SLINGER, in the exact style, proportions and pose of the attached knight.
A sunburnt, mischievous shepherd boy with a cheeky grin, a mop of curly brown hair, bare head.
- Body: a short sleeveless tunic reaching above the knee in "house colour" (light grey), a rope
  belt (brown).
- Bare arms and bare legs (skin #f0cfb0), leather sandals with straps, both feet pointing right.
- A coiled sling of brown cord hanging at the hip on the right of the picture, not overlapping
  the arm.
- Hands empty.
```

### Sapeur (Sapper)
```
Character sheet: the SAPPER, in the exact style, proportions and pose of the attached knight.
A stocky, dusty miner with a big moustache, bushy eyebrows and a satisfied frown.
- Head: a round felt cap in "second colour" (medium grey).
- Body: a tunic with long sleeves in "house colour" (light grey); over it a brown leather apron
  from chest to knees, with a narrow brown belt.
- Legs: brown hose, heavy brown boots, both feet pointing right.
- A pickaxe slung across his back: the wooden haft and the iron head stick out behind his
  shoulders, on the left of the picture, not overlapping the arms or the head.
- Hands empty.
```

### Clerc (Cleric)
```
Character sheet: the CLERIC, in the exact style, proportions and pose of the attached knight.
A round, kindly, slightly smug monk-priest with rosy cheeks and a tonsure (a ring of hair round
a bald crown).
- Body: a long white linen alb (#f3ecd9) reaching the ankles; over it a bell-shaped chasuble in
  "house colour" (light grey) with a gold band (orphrey) down the front; the alb's long sleeves
  are "house colour" too.
- The alb stops above the ankles: the lower legs (white hose) and simple brown shoes show,
  legs apart, both feet pointing right.
- In the hand on the right of the picture (the front hand), a tall gilded crozier, held upright
  beside the body, its crook above head height, the staff ending at the ground; it must not
  overlap the head or the torso.
- The other hand empty.
```

### Roi (King)
```
Character sheet: the KING, in the exact style, proportions and pose of the attached knight.
A portly, self-satisfied king with a magnificent forked beard and a long nose.
- Head: a gold crown with fleurons (#d4a93c).
- Body: a robe with long sleeves in "second colour" (medium grey), reaching mid-calf, a narrow
  belt in "house colour" (light grey) with a gold buckle; an ermine collar (white with small black
  tails) round the shoulders.
- A long mantle in "house colour" (light grey), lined with ermine, hanging behind him from the
  shoulders to the calves; it shows only behind the body and on the left of the picture, never in
  front of the arms or the legs.
- Lower legs in red-brown hose and pointed brown shoes, legs apart, both feet pointing right.
- Hands empty, no sceptre.
```

### Facultatif : les armes tenues, communes aux six classes
Aujourd'hui, l'arc et la pierre sont dessinés en vectoriel. Pour qu'ils soient dans le même style que les personnages :
```
Two separate objects side by side, in the exact style of the attached knight (same thick brown
outline, flat colours), on a pure white background, nothing else, no hands:
1. a short wooden self bow, strung, standing upright, its back to the right, the string a thin
   pale line on the left; a small red grip wrapping in the middle;
2. a fist-sized round grey stone with one pale highlight.
Each object about one third of the canvas height, well apart from each other.
```

---

## 3. Avant de m'envoyer une image : la vérifier

Si un seul point manque, régénérer :

- [ ] Fond blanc uni, sans ombre, sans sol et sans contour blanc autour du personnage.
- [ ] Un seul personnage, entier, de la même taille que le Chevalier : il touche presque le haut et le bas de l'image.
- [ ] Tête de profil tournée vers la droite, **les deux pieds tournés vers la droite**.
- [ ] Du blanc entre les jambes, et entre chaque bras et le corps.
- [ ] Mains vides, sauf la crosse du Clerc.
- [ ] Vêtements de la maison en **gris clair**, vêtements de la seconde couleur en **gris moyen**, sans aucune couleur dessus.
- [ ] Contours aussi épais que ceux du Chevalier.

Ensuite, m'envoyer l'image dans la conversation. Je la découpe, je la recale sur le squelette d'animation et je vous montre la planche de ses poses avant de l'intégrer.
