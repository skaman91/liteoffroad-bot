
const commands = [
  {
    command: "points",
    description: "Показать установленные точки"
  },

  {
    command: "map",
    description: "Показать общую карту с точками"
  },

  {
    command: "take",
    description: "Взял точку"
  },

  {
    command: "install",
    description: "Установил точку"
  },

  {
    command: "results",
    description: "Общие результаты игры"
  },

  {
    command: "eventresults",
    description: "Результаты за этап"
  },

  {
    command: "rules",
    description: "Правила игры",
  },

  {
    command: "help",
    description: "Застрял/Нужна помощь",
  },

  {
    command: "profile",
    description: "Посмотреть свой профиль"
  },

  {
    command: "archive",
    description: 'Показать архив взятых точек'
  },

  {
    command: "rules",
    description: "Правила игры",
  },

  {
    command: "start",
    description: "Запуск бота и регистрация в системе"
  },

  {
    command: "changecity",
    description: "Сменить город"
  }
]

const rules1 = `<b>Игра «Застрянь друга»</b> — это ориентирование с элементами бездорожья в Санкт-Петербурге и ЛО.\n
❗️Администрация группы не несет ответственности за возможные повреждения и/или поломки транспортных средств, и возможные травмы участников игры, мы лишь предоставляем Вам платформу для игры❗️\n
Участники ставят точки в игровой зоне, отмеченной <a href="https://point-map.ru/">на карте</a>, и оставляют их координаты с помощью бота @liteoffroad_bot.\n
Вам нужно найти точку, которую установил предыдущий участник, соблюдая определенные правила. За нарушение этих правил игрок будет оштрафован.  Для взятия точек можно объединяться в группы.\n
На карте есть три вида точек:
•🟢 Зеленые. Точки «лайт». Когда вы устанавливаете эту точку, лебедку использовать нельзя.
•🔴 Красные. Точки «хард». Эти точки стоят в сложных местах, где лебедка необходима.
•🔵 Синие. Точки, для установки которых может потребоваться лебедка, но на пути не должно быть болот (наличие болот проверяется по нашей карте)\n
Точку ищем с помощью GPS-навигатора. 
Мы рекомендуем такие способы: 
-<a href="https://point-map.ru/">Официальная карта игры</a>;
-OsmAnd;
-Guru maps;
-прочие аналоги.\n
Точка считается «взятой» после оформления через бота @liteoffroad_bot. Он автоматически оповестит всех участников в основном канале @liteoffroad.\n
 <b>Как взять точку?</b>
• Фотофиксация в стиле «рука–рука» (вы держитесь за табличку точки). Но мы адекватные — подойдёт и «рука–нога» 😉.  
• Один человек должен одновременно касаться точки и своего автомобиля.  
• Нельзя браться за руки со штурманом, чтобы «дотянуться» искусственно.  
• Нужно касаться именно за табличку, за палку нельзя.\n
📌 Если вы один:
Используйте штатив или селфи-палку для телефона. На фото должно быть чётко видно:  
• Точку (табличку),  
• Ваш автомобиль рядом,  
• Вас, дотрагивающегося до точки и машины.\n
Загрузив точку в бот, Вы можете: 
1. Забрать табличку и установить её в другом интересном месте, выбрав в боте опцию «забрал точку»;
2. Оставить ее стоять дожидаться следующего игрока, выбрав в боте опцию «оставил точку» В этом случае рейтинг точки будет увеличен на 1 балл.
Точки, которые игроки не забирают в течение недели и далее, получают +1 балл к рейтингу каждую неделю (максимум 10 баллов). Так же 1 балл добавляется участнику, который установил эту точку.\n
Если у Вас сломалась машина, Вы можете обратиться к нам в клубный внедорожный сервис 🚩Точка 4х4🚩, Шафировский пр., 10А, бокс 12-9. У нас есть возможность выехать на место поломки. Телефон для связи +79006356625\n
Если что-то пошло не по плану, и Вы застряли/сломались, Вы сможете загрузить Ваши координаты и описание проблемы в основной канал с помощью кнопки <b>"Сломался/Нужна помощь".</b>
`
const rules2 = `<b>Основные правила:</b>\n
<b>1. Не уезжайте слишком далеко!</b>
Ставьте точки в пределах игровой зоны, обозначенной на нашей карте, или не дальше 50км от КАД по прямой.
Штраф за нарушение — 2 балла.
В процессе этапа зоны могут меняться.
Актуальные зоны нужно смотреть на карте. Зона 50км это основная зона игры. На время этапа могут быть обозначены дополнительные зоны этапа, устанавливая точки в которых, вы получите баллы в рейтинге этапа. Если взять точку за пределами зоны этапа, то рейтинг этапа вам будет начислен, а за установку нет.\n
<b>2. Не дайте украсть Вашу точку!</b> 
Ставьте точки не на виду. Если Вы приехали за точкой и её нет, сделайте несколько фотографий места и отправьте это в чат. Если в текущий день не появится игрок, который не оформил взятие, Вам будет начислен рейтинг этой точки.
Штраф игроку, выбравшему неподходящее место для точки в случае, если точка была установлена менее 7 дней назад, — 1 балл.\n
<b>3. Не лезьте на рожон!</b>
Категорически запрещается установка точек:
• На действующих военных полигонах и стратегических объектах
• В границах особо охраняемых природных территорий (ООПТ) 
• В заповедниках, заказниках, национальных парках
• На любых других территориях, где движение транспорта запрещено законом\n
<b>4. Не ставьте точки на льду!</b>
Запрещается установка точки на льду рек, озер, каналов и т.п., а также в местах, куда можно попасть только по льду.
Штраф за нарушение — 5 баллов.\n
<b>5. Не ставьте точки высоко!</b>
Запрещается установка точек выше 3 метров от земли. До точки должен дотянуться любой взрослый человек, не используя специальную технику. 
Штраф за нарушение — 2 балла.\n
<b>6. Ездите на машинах!</b> 
Мотоцикл, снегоход, велосипед, паровоз, гужевая повозка, санки, квадроцикл, лошади, ролики, беговые собаки и прочие способы передвижения, не являющееся автомобилем, — не подходят для взятия точек. 
Штраф за нарушение — стоимость взятой/установленной точки или 2 балла.\n
<b>7. Оформляйте точки сразу!</b>
В случае, если не было сети, оформить точку нужно сразу же, как у Вас есть появится связь. Иначе это будет считаться умышленной манипуляцией результатами.
Штраф — 2 балла.\n
<b>8. Соблюдайте дистанцию!</b>
При установке точки на новое место, оно должно быть не ближе 5000 метров (5км) от места взятия. Либо другое расстояние, если о нем было объявлено. В формате некоторых этапов расстояние может меняться.
Штраф за нарушение — 2 балла.\n
<b>9. Не повторяйтесь!</b>
Нельзя взять точку, которую установили Вы. Нельзя снова взять точку, если Вы ее уже взяли, но оставили на месте. Чтобы Вы смогли взять точку, ее  должен переставить другой участник, но не ранее чем через 24 часа после вашего взятия.\n
<b>10. Не задерживайте!</b>
Не держите у себя точки. Точку нужно установить в течение трех дней (либо другой срок, о котором будет объявлено дополнительно) со момента взятия. Если Вы взяли точку и по какой-то причине не можете ее установить (заболели, сломались и тд), Вы можете передать эту точку для установки другому участнику или поставить ее на другом автомобиле самостоятельно. 
Штраф за хранение точки просроченной точки — 1 балл за каждый день.\n
<b>11. Не двигайте точки!</b>
Когда Вы забираете точку, Вы должны взять точку ровно так, как её поставил предыдущий участник, не наклоняя и не переставляя её.
Штраф — стоимость взятой точки.\n
<b>12. Не жульничайте!</b>
Не используйте фотошоп, не переставляйте таблички, не манипулируйте результатами. 
В случае несоблюдения этого правила рейтинг участника будет аннулирован.\n
Так же:
 • Не жадничайте!
Точку можно не забирать с собой. Оформите взятие в боте с отметкой о том, что точка оставлена. В этом случае вам будет начислена стоимость точки, а к самой точке будет добавлен 1 балл.
 • Будьте внимательны! 
Смотрите последние координаты точек в официальном боте или на карте.
 • Делитесь добром! 
Вы можете оставлять для участников подарки или записки, которые не будут привлекать внимание и не будут наносить вред окружающей среде.\n
 • <b>Играйте честно!</b>\n
Не ищите лазейки в правилах, оформляйте точки вовремя. Все на Вашей совести!\n
<b>Удачи!</b>
`

const adminCommands = `
          Доступные админские команды\n
1. <code>вернуть 232423</code> - Достать точку из архива, нужен id архивной точки\n
2. <code>обновить рейтинг этапа</code> - пересчитать рейтинг этапа\n
3. <code>обновить рейтинг игры</code> - персчитать общий рейтинг\n
4. <code>обновить рейтинг этапа игры</code> - пересчитать оба рейтинга сразу\n
5. <code>Добавить точку 22 Лайт Санкт-Петербург</code> - добавление точки, нужно выбрать номер, ранг и город\n
6. <code>забанить </code> - после слова забанить написать username пользователя\n
7. <code>разбанить </code> - так же\n
8. <code>2 этап старт Санкт-Петербург</code> - выбрать номер этапа и город, облулится рейтинг за этап у игроков\n
9. <code>2 этап стоп Санкт-Петербург</code> - пока в разработке\n
`

module.exports = {
  commands,
  rules1,
  rules2,
  adminCommands
}