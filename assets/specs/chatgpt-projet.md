# Projet ChatGPT : les personnages de Medieverse

Ce guide sert à produire, dans ChatGPT, les images des cinq classes qui restent (Archer, Frondeur, Sapeur, Clerc, Roi). Chaque image doit pouvoir être découpée sans retouche par le script du Chevalier ([knight/gen/cut.py](../units/knight/gen/cut.py)).

Les consignes pour ChatGPT sont en anglais : c'est la langue qu'il suit le mieux pour les images. Les explications autour sont en français.

## La méthode : transformer le Chevalier, pas dessiner à partir de rien

Premier essai (Archer, 2026-10-31) : ChatGPT a dessiné une page de manuscrit. Il a mis un fond de parchemin, un cadre et des fleurons, un personnage à 7 têtes, un trait fin hachuré et les mains sur les hanches. Deux causes :
- Les mots « Maciejowski Bible », « manuscript » ou « illumination » lui font dessiner une page enluminée. Ils sont retirés.
- Partir d'une description laisse ChatGPT libre du cadrage, de la pose et des proportions.

On **lui donne donc l'image du Chevalier à modifier**. Une retouche d'image garde la toile, la taille, la pose, le trait et le fond blanc ; seuls changent la tête, les habits et l'équipement.

---

## 1. Créer le projet (une seule fois)

1. Dans ChatGPT, ouvrir **Projets → Nouveau projet**, et le nommer « Medieverse — personnages ».
2. **Instructions du projet** : coller le bloc ci-dessous tel quel. Si vous aviez collé la version précédente, la remplacer entièrement.

```
You edit ONE reference picture: a cartoon knight on a white background (knight-source.png,
attached to each message). For every request, return that SAME picture with only the character's
head, clothes and gear changed. Everything else stays exactly as in the reference:

- Same canvas (portrait 1024 x 1536), same plain pure white background, same size and place of
  the figure, same pose: head in profile facing right, torso three-quarter, legs straight and
  apart, both arms hanging slightly away from the body, white gaps between the arms and the body
  and between the legs.
- Same drawing: chibi proportions (head as big as the torso, about 3 heads tall), very thick even
  dark-brown outlines, flat colours, folds as thin dark lines, no shading, no gradient.
- Both feet point to the RIGHT. Hands empty unless the request says otherwise.
- Clothes marked "house colour" are plain LIGHT GREY (#cfcfcf); clothes marked "second colour"
  are plain MEDIUM GREY (#9a9a9a). No hue at all on them. Skin #f0cfb0, browns #6b4a2e and
  #8a5a34, gold #d4a93c, green #4d7a4a, white linen #f3ecd9.

Never add: parchment or paper texture, beige or coloured background, frame, border, corner
ornaments, flourishes, text, ground, cast shadow, hatching, watercolour, realistic proportions,
a second character. Never put the hands on the hips or in front of the body.
```

3. **Réglages** : une image par conversation. Si une image rate, **régénérer** plutôt que demander une retouche.

---

## 2. Les demandes, une par classe

Pour chaque classe :
1. ouvrir une **nouvelle conversation** dans le projet ;
2. **joindre `knight-source.png`** au message (le glisser dedans) : c'est l'image qu'il modifie ;
3. coller la demande.

### Archer
```
Edit this picture. Keep the canvas, white background, pose, size, outlines and flat style exactly.
Turn the knight into the ARCHER, a wiry, cheerful young man:
- Remove the helm and the mail coif: show a round cartoon face in profile facing right (almond
  eye, small nose, little smile, curly brown hair), the same size as the helm was.
- A hood whose short shoulder cape ends in pointed dagges, in medium grey (second colour).
- Remove the mail and the shield. A knee-length tunic with long sleeves in light grey (house
  colour), a narrow brown belt with a small gold buckle.
- Green hose, short brown boots, both feet pointing right.
- A brown quiver with a few arrows on his back, sticking up behind the shoulder on the LEFT of
  the picture, clear of the arms and the head.
- Arms hanging as in the reference, hands empty, no bow.
```

### Frondeur (Slinger)
```
Edit this picture. Keep the canvas, white background, pose, size, outlines and flat style exactly.
Turn the knight into the SLINGER, a sunburnt, cheeky shepherd boy:
- Remove the helm and the mail coif: a round cartoon face in profile facing right with a cheeky
  grin and a mop of curly brown hair, bare head, the same size as the helm was.
- Remove the mail and the shield. A short sleeveless tunic above the knee in light grey (house
  colour), a brown rope belt.
- Bare arms and bare legs in skin colour, leather sandals, both feet pointing right.
- A coiled brown sling hanging at the hip on the RIGHT of the picture, clear of the arm.
- Arms hanging as in the reference, hands empty.
```

### Sapeur (Sapper)
```
Edit this picture. Keep the canvas, white background, pose, size, outlines and flat style exactly.
Turn the knight into the SAPPER, a stocky, dusty miner:
- Remove the helm and the mail coif: a round cartoon face in profile facing right with a big
  moustache and bushy eyebrows, a round felt cap in medium grey (second colour), the same size as
  the helm was.
- Remove the mail and the shield. A tunic with long sleeves in light grey (house colour) and,
  over it, a brown leather apron from chest to knees, a narrow brown belt.
- Brown hose, heavy brown boots, both feet pointing right.
- A pickaxe slung on his back: haft and iron head stick out behind the shoulders on the LEFT of
  the picture, clear of the arms and the head.
- Arms hanging as in the reference, hands empty.
```

### Clerc (Cleric)
```
Edit this picture. Keep the canvas, white background, pose, size, outlines and flat style exactly.
Turn the knight into the CLERIC, a round, kindly, slightly smug priest:
- Remove the helm and the mail coif: a round cartoon face in profile facing right with rosy
  cheeks and a tonsure (ring of hair round a bald crown), the same size as the helm was.
- Remove the mail and the shield. A white linen alb (#f3ecd9) stopping ABOVE the ankles, with
  long sleeves in light grey (house colour); over it a bell-shaped chasuble in light grey (house
  colour) with a gold band down the front.
- Below the alb: white hose and simple brown shoes, legs apart, both feet pointing right.
- In the hand on the RIGHT of the picture, a tall gold crozier held upright beside the body, its
  crook above the head, its foot at the ground, clear of the head and the body.
- The other arm hanging as in the reference, hand empty.
```

### Roi (King)
```
Edit this picture. Keep the canvas, white background, pose, size, outlines and flat style exactly.
Turn the knight into the KING, a portly, self-satisfied monarch:
- Remove the helm and the mail coif: a round cartoon face in profile facing right with a long
  nose and a magnificent forked beard, a gold crown with fleurons, the head the same size as the
  helm was.
- Remove the mail and the shield. A robe with long sleeves in medium grey (second colour)
  stopping at mid-calf, a narrow belt in light grey (house colour) with a gold buckle, an ermine
  collar (white with small black tails).
- A long mantle in light grey (house colour) lined with ermine, hanging BEHIND him from the
  shoulders to the calves, showing only behind the body on the LEFT of the picture.
- Red-brown hose and pointed brown shoes, legs apart, both feet pointing right.
- Arms hanging as in the reference, hands empty.
```

### Facultatif : les armes tenues, communes aux six classes
```
Edit this picture: remove the knight entirely and keep only the white background. In the same
flat style with the same thick dark-brown outline, draw two separate objects well apart:
1. a short wooden bow, strung, standing upright, its back to the right, a small red grip in the
   middle;
2. a fist-sized round grey stone with one pale highlight.
Each about one third of the canvas height. Nothing else.
```

---

## 3. Avant de m'envoyer une image : la vérifier

Si un seul point manque, régénérer :

- [ ] Fond **blanc** uni : pas de parchemin, de cadre, de fleurons, d'ombre ni de sol.
- [ ] Même taille et même place que le Chevalier, personnage entier.
- [ ] Gros personnage trapu, à 3 têtes de haut, et non une silhouette élancée.
- [ ] Tête de profil tournée vers la droite, **les deux pieds tournés vers la droite**.
- [ ] Bras le long du corps avec du blanc entre eux et le torse, sans mains sur les hanches, et du blanc entre les jambes.
- [ ] Mains vides, sauf la crosse du Clerc.
- [ ] Vêtements de la maison en **gris clair**, vêtements de la seconde couleur en **gris moyen**, sans aucune couleur dessus.
- [ ] Contours épais et aplats comme sur le Chevalier : ni hachures ni aquarelle.

Ensuite, m'envoyer l'image dans la conversation. Je la découpe, je la recale sur le squelette d'animation et je vous montre la planche de ses poses avant de l'intégrer.
