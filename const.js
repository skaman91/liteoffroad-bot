
const commands = [
  {
    command: "start",
    description: "Запуск бота и регистрация в системе"
  },

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
    command: "profile",
    description: "Посмотреть свой профиль"
  },

  {
    command: "results",
    description: "Общие результаты игры"
  },

  {
    command: "archive",
    description: 'Показать архив взятых точек'
  },

  {
    command: "rules",
    description: "Правила игры",
  }
]

const rules = `
          <b>Игра "Застрянь друга"</b> это ориентирование с элементами бездорожья в СПб и ЛО
Актуальные точки можно посмотреть карте:
<a href="https://point-map.ru/">Ссылка на карту со всеми точками</a>.
Красным отображаются установленные точки (они физически есть на месте)\nВзятые точки будут становиться зелеными (они в архиве, на месте их нет).

При взятии точки оформите взятие точки с помощью взятия в меню бота.

Обязательно оформляйте взятие сразу после взятия точки, указывая номер, который на ней написан, что бы другой человек случайно к ней не приехал.

Кто хочет может собираться в группы для взятия точек./
Суть состоит в том, чтобы по координатам, выложенными в данном обсуждении, найти точку, установленную предыдущим участником. Точку ищем с помощью GPS - навигатора или любых других гаджетов.

Условия взятия точки точно такие же, как в соревнованиях по GPS-ориентированию. Делаем фото взятия точки «рука-рука», но мы адекватные, поэтому можно и "рука-нога" :) (т.е. одна рука должна касаться автомобиля, вторая контрольной точки). Если участник один, допускается селфи, где отчетливо видно точку, автомобиль рядом с точкой и водителя.
Конкурс фотографий не устраиваем, если видно что машина рядом с точкой, то фото подходит.

Выкладываем подтверждающее фото в обсуждение , после чего точка считается взятой. Тем самым информируя всех остальных участников.

Теперь Вы можете забрать табличку и установить её в другом интересном месте, до которого добраться не так легко на Ваше мнение. Или же оставить точку на своем месте, сообщив об этом в обсуждении. Для привлечения начинающих покорителей бездорожья, точки можно ставить проходимые для штатных автомобилей на шоссейной резине. Точка может быть триальной, и это отчасти значительно интереснее!
Если добраться до точки не так-то просто, то сделайте об этом комментарий, что бы другие понимали уровень сложности.

Правила:

1. Устанавливайте точки в пределах города Санкт-Петербург или неподалеку от города не дальше 50 км.

2. Запрещается установка точки на льду рек, озер, каналов и т.п., а так же в местах куда единственный путь лежит по льду.

4. Для взятия и установки точки требуется АВТОМОБИЛЬ. Мотоцикл, снегоход, велосипед, гужевая повозка и тд не подходят.

5. Обязательно оформлять через бота ВЗЯТИЕ и УСТАНОВКУ точки. При переустановке точки, ФОТО УСТАНОВКИ с новыми координатами!
5.1 При переустановке точки на новое место, установка должна быть не ближе 500 метров от места взятия.
5.2 Нельзя брать точку повторно, если вы ее установили или брали, но оставили на месте. Чтобы вы смогли взять эту точку, ее сначала должен переставить другой участник.
5.3 Если вы взяли точку и по какой-то причине не можете ее установить (заболели, сломались и тд). То вы можете передать эту точку для установки другому участнику по договоренности. Самому на другом автомобиле устанавливать запрещается!!!

6. При взятии точки, не допускается наклонять или переставлять точку (потому что Вам так легче). Берёте точку так, как её поставил предыдущий участник!

7. Точку можно не забирать, а просто сфоткаться с ней. Время на установку новой точки не больше 3 суток! Можно просто взять точку и оставить её на прежнем месте! Если забираете табличку, то устанавливайте в новом месте её сразу, не бросайте в багажник с мыслями "До выходных полежит, подождет", "В отпуске поставлю" и тд.

8. Всегда смотрите последние координаты точек в этом боте.

9. При желании вы можете оставлять для участников презенты или записки. Главное что бы они не привлекали внимания и не наносили вред окружающей среде и животным!

10. Если что то пошло не по плану, вы застряли, сломались, обсохли , сел аккумулятор и т. п. пишите нам в чат (если состоите в нем) или в группу взаимопомощи на дорогах https://vk.com/vnd78

11. Если участник будет замечен в умышленном манипулировании результатами, переставлении таблички, фотошопе и т.п. то это ведет к аннулированию его результата

Администрация группы не несет никакой ответственности за возможные повреждения или поломки транспортных средств, и возможные травмы участников игры!!!!`



module.exports = {
  commands,
  rules
}