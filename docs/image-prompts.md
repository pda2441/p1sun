# Промпты генерации изображений

Дата: 25 октября 2026 года. Режим: встроенный `image_gen`, новая генерация, `transparent_background: false`. Внешний API/CLI не применялся. Существующие изображения не передавались как edit target. Пользовательский макет был изучен как ориентир человеком/агентом, но не отправлялся генератору.

Итоговые JPEG находятся в `assets/images/`; исходные PNG инструмента остаются в стандартном каталоге `.codex/generated_images`. Для использования сайта эти внешние PNG не нужны.

## Hero

Идентификатор исходника: `exec-e634227d-1b41-4205-8dc3-3146c05ae588.png`. Результат: 1536×1024. Техническое преобразование: PNG → JPEG quality 88, без кадрирования. Итог: `hero.jpg` и тот же кадр `adjaruli.jpg`.

```text
Use case: photorealistic-natural. Asset type: premium Georgian cafe restaurant website hero food photography. Create one landscape photograph 1536x1024: an authentic Adjarian khachapuri, golden blistered boat-shaped bread containing melted sulguni cheese, a single glossy deep-yellow egg yolk and small pat of butter, on an imperfect warm taupe ceramic plate on a rustic walnut table. Close 45-degree overhead angle, bread fills center/right frame with all tips visible. Dark burgundy linen, a few fresh green herbs, pomegranate seeds only at edges, one half-visible wine glass in rear. Beautiful tactile crust, realistic cheese, natural soft warm side-window light, rich dark wood, understated appetizing editorial restaurant photography, shallow depth of field but entire khachapuri sharp. No text, labels, branding, watermark, collage, people or hands. This is a fictional cafe concept. Deliver an actual photographic image, not a website mockup.
```

## Блюда

Идентификатор исходника: `exec-4731ea4d-c9f0-46fc-8438-d10741b7724b.png`. Запрошен лист 3072×2304, фактически получен 1448×1086. Техническая нарезка: столбцы x = 0/362/724/1086/1448, строки y = 0/355/682/1086. JPEG quality 90. Каждый кадр проверен по предмету. Кадр аджарули заменён более крупной отдельной hero-генерацией.

```text
Use case: photorealistic-natural. Asset type: restaurant menu FOOD PHOTOGRAPHY CONTACT SHEET, 12 equally sized photographs in a precisely regular 4 columns by 3 rows grid, landscape total 3072x2304, each cell square 768x768, ZERO gutters, ZERO frames, NO text/labels/numbers. Each cell must show only the assigned dish, wholly in its own cell, a complete plate centered with safe margin; consistent premium editorial real food photography, warm natural side-window light, rustic dark walnut table, imperfect taupe ceramic plates, crisp appetizing details, deep wine burgundy linen. STRICT CELL ORDER reading left to right: Row1 Col1 authentic Georgian khinkali dumplings with pinched pleated twisted tops on ceramic plate, Col2 Adjarian boat-shaped khachapuri with melted cheese and one bright egg yolk, Col3 Megrelian khachapuri a ROUND flat bread pie with melted lightly blistered cheese on top cut into wedges, Col4 pkhali three colorful walnut vegetable balls green spinach/beetroot red/carrot ochre, pomegranate garnish. Row2 Col1 badrijani rolled fried eggplant slices filled with pale walnut paste topped with pomegranate, Col2 lobio red kidney bean stew in a rustic brown clay pot with cilantro, Col3 ojakhuri chunky browned pork and roasted potato wedges with red onion and herbs, Col4 satsivi chicken pieces in creamy pale beige walnut sauce, pomegranate garnish. Row3 Col1 fresh Georgian tomato cucumber herb salad with walnuts and red onion, Col2 medovik a neat slice of many-layer honey cake with cream, Col3 authentic churchkhela hanging-sausage shaped burgundy grape walnut sweets whole and sliced on a small board, Col4 homemade tarragon lemonade in a glass carafe and glass with green tarragon sprig and lemon. Dish identification matters. No stray food crossing between cells. These are 12 separate photo compositions, no restaurant UI, no typography, no watermarks, no people.
```

## Повышение детализации: выбранные листы 2×2

После визуальной оценки координатор выбрал все 11 новых кадров. Этот этап заменил черновые фото блюд выше; hero/adjaruli и атмосфера остались из первоначальных генераций. Каждый новый лист получен 1254×1254 при запросе 2048×2048. Нативные JPEG без апскейла, quality 90. Все три новых листа просмотрены; отдельные кандидаты также просмотрены координатором. Резервный khinkali-open не выбран и в проект не включён.

### Хинкали / пхали / сациви / бадриджани

Исходник: `exec-9db40d5a-87dc-4529-8982-c7c703a44b05.png`. Столбцы x = 0/627/1254, строки y = 0/595/1254. Кадры 627×595 (верх) и627×659 (низ). 

```text
Use case: photorealistic-natural. Produce a HIGH RESOLUTION square 2048x2048 FOOD PHOTOGRAPHY CONTACT SHEET. Precisely 2 equal columns and 2 equal rows, 4 independent square photos, no gutters, no borders, absolutely no text/numbers/labels. Each dish on a taupe rustic ceramic plate centered fully inside its own square. Premium Georgian restaurant food editorial photography: rich warm natural window light, dark walnut tabletop, deep burgundy linen, detailed natural textures, appealing real food, green herbs/pomegranate accents. Straight 45 degree overhead food photography, generous plate margin. All four photos must be equally detailed and sharp. No people, hands, branding, mockups, or watermarks. Use highest image resolution possible, ideally2048x2048. TOP LEFT: authentic Georgian KHINKALI, five large steamed dumplings with pleated twisted tops, sprinkled black pepper. TOP RIGHT: PKHALI, three vivid walnut-vegetable balls green spinach, ruby beet and orange carrot with pomegranate garnish. BOTTOM LEFT: SATSIVI, chicken pieces in pale beige creamy walnut sauce, cilantro/pomegranate garnish. BOTTOM RIGHT: BADRIJANI, four grilled eggplant rolls filled with walnut paste, visible eggplant skin and sliced roll ends, pomegranate garnish.
```

### Мегрельский хачапури / лобио / оджахури / салат

Исходник: `exec-b9fef643-d415-4094-9b04-68e6e96dfaaf.png`. Столбцы и строки 0/627/1254. Все кадры 627×627. 

```text
Use case: photorealistic-natural. Produce a HIGH RESOLUTION square 2048x2048 FOOD PHOTOGRAPHY CONTACT SHEET. Precisely 2 equal columns and 2 equal rows, 4 independent square photos, no gutters, no borders, absolutely no text/numbers/labels. Each dish on a taupe rustic ceramic plate centered fully inside its own square. Premium Georgian restaurant food editorial photography: rich warm natural window light, dark walnut tabletop, deep burgundy linen, detailed natural textures, appealing real food, green herbs/pomegranate accents. Straight 45 degree overhead food photography, generous plate margin. All four photos must be equally detailed and sharp. No people, hands, branding, mockups, or watermarks. Use highest image resolution possible, ideally2048x2048. TOP LEFT: MEGRELIAN KHACHAPURI, a ROUND flat Georgian cheese pie with a golden blistered cheese layer on top, cut into wedges, no egg. TOP RIGHT: LOBIO, authentic red kidney bean stew in a round brown clay pot with cilantro and red onion. BOTTOM LEFT: OJAKHURI, browned pork chunks and roasted potato wedges with sliced red onion and herbs. BOTTOM RIGHT: fresh GEORGIAN SALAD, ripe tomato wedges and crisp cucumber chunks, red onion, fresh herbs and walnuts.
```

### Медовик / чурчхела / лимонад / резервные хинкали

Исходник: `exec-3347896a-5ef5-4026-990d-af1296f2c01c.png`. Столбцы и строки 0/627/1254. Выбраны первые три кадра 627×627. 

```text
Use case: photorealistic-natural. Produce a HIGH RESOLUTION square 2048x2048 FOOD PHOTOGRAPHY CONTACT SHEET. Precisely 2 equal columns and 2 equal rows, 4 independent square photos, no gutters, no borders, absolutely no text/numbers/labels. Each dish on a taupe rustic ceramic plate centered fully inside its own square. Premium Georgian restaurant food editorial photography: rich warm natural window light, dark walnut tabletop, deep burgundy linen, detailed natural textures, appealing real food, green herbs/pomegranate accents. Straight 45 degree overhead food photography, generous plate margin. All four photos must be equally detailed and sharp. No people, hands, branding, mockups, or watermarks. Use highest image resolution possible, ideally2048x2048. TOP LEFT: MEDOVIK, a neat slice of golden multi-layer honey cake with cream layers and fine crumb topping on a small plate. TOP RIGHT: authentic CHURCHKHELA, three long burgundy grape-must coated strings of walnuts laid on a rustic serving board, whole and cut into discs clearly showing walnut cross sections. BOTTOM LEFT: TARRAGON LEMONADE, a glass carafe and tumbler filled with pale green lemon soda, fresh tarragon sprigs, lemon slices, droplets. BOTTOM RIGHT: a close-up of authentic KHINKALI steamed pleated dumplings, one cut open to show juicy filling, on a rustic plate.
```

## Атмосфера

Идентификатор исходника: `exec-4d8dba3f-f0a3-400e-9b31-c714effe4462.png`. Запрошен 1536×3072, фактически получен 887×1774. Техническая нарезка по строкам y = 0/592/1182/1774; JPEG quality 89. Верхний кадр → `interior.jpg`, средний → `table.jpg`, нижний → `detail.jpg`.

```text
Use case: photorealistic-natural. Asset type: restaurant atmosphere PHOTOGRAPHIC CONTACT SHEET, three landscape photographs in a precise grid of 1 column by 3 rows, total image 1536x3072, each horizontal photo 1536x1024, ZERO gutters, ZERO borders, no text. SAME fictional modern Georgian cafe interior in all three pictures, atmospheric premium editorial interior photographs, deep wine burgundy upholstery, warm cream textured plaster arches, dark walnut tables, traditional patterned Georgian rugs, potted olive plants, wicker pendant lights, amber evening window light. TOP PHOTO: wide beautifully composed empty dining room, layered arches, tables with simple linen napkins and ceramic plates, warmly lit pendants. MIDDLE PHOTO: close intimate vignette of a small table near arched window, wine glasses with red wine, small candles, linen napkins, ceramic tableware and pomegranate, no visible food necessary. BOTTOM PHOTO: atmospheric detail of plaster arch with woven pendant light and rug, olive branch shadows on wall, dining area in background. Human scale, sophisticated warmth, soft light and tactile materials, authentic photography, no people, branding, signage, text, watermarks. Each shot composed independently within its own rectangular cell.
```
