# Исследование анимаций

Изучено 2026-10-25 через доступный веб-инструмент до реализации. Источники использованы как идеи; коммерческий код и чужая композиция не копировались. Самих интерактивных демо в отдельном браузере не проигрывали; исследование опиралось на страницы и описание эффектов.

1. [Codrops — UI Interactions & Animations Roundup #45, Cuisine Restaurant Branding Animations](https://tympanus.net/codrops/2024/07/03/ui-interactions-animations-roundup-45/). Ресторанная подача через согласованную типографику и движение. Для WW KiMa — единый темп появления заголовка, текста и CTA вместо множества несвязанных эффектов.
2. [Codrops — Full Image Reveal Effect](https://tympanus.net/Development/FullImageReveal/). Приём перехода от превью к большой фотографии. В диалоге блюда применён самостоятельный короткий FLIP-переход копии фотографии; нативный dialog сохраняет доступность.
3. [Codrops — Block Reveal Effects](https://tympanus.net/Development/BlockRevealers/index.html). Чёткое раскрытие крупных изображений и блоков. В проекте — спокойное однократное вступление фотографии и появление отдельных секций при прокрутке; без постоянного маскирования контента.
4. [MDN — Using the Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API). Официальная справка по управляемым анимациям, cancel и finished. На ней основаны прерываемые переходы разделов, фильтров и диалогов.
5. [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion). Официальная справка по настройке уменьшенного движения. При reduce отключены вступительные перемещения, FLIP и параллакс; функциональность остаётся.

Дополнительно изучена [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API). Для этого проекта выбрана Web Animations API с явным управлением состояниями: она не требует отдельной библиотеки и позволяет обрабатывать быстрые повторные действия.
