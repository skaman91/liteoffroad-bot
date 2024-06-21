import TelegramBot from 'node-telegram-bot-api'
import mongoose, { Mongoose } from 'mongoose'
import { DB } from './auth/bot.mjs'

export default class BotLogic {
  constructor ({
    apiToken
  }) {
    this.apiToken = apiToken
    this.bot = null
  }
  async start () {
    mongoose.Promise = global.Promise
    mongoose.connect(DB)
      .then(() => console.log('Connected to the MongoDB'))
      .catch((err) => console.log('Failed connected to the MongoDB:', err))

    const Point = mongoose.model('Points', {})
    const pnt = {
      name: 'Виктор',
      text: 'test',
    }
    await new Point(pnt).save().catch(err => console.log(err))

    if (!this.bot) {
      this.bot = new TelegramBot(this.apiToken, {polling: true})
      console.log('bot', this.bot)
      this.bot.on('message', msg => this.onMessage(msg))
    }
  }
  async onMessage (msg) {
    try {
      if (msg.text) {
        console.log(msg)
        const chatId = msg.chat?.id
        const user = msg?.from.first_name
        if (/точки$/i.test(msg.text)) {
          // await this.bot.sendMessage(chatId, `Здоров ${user}! Вот список актуальных точек:
          //
          // Точка №1 (северная)
          // 60.342349, 30.017123 ps путь к точке уровень лайт, при взятии точки может потребоваться лебедка, нам при установке не потребовалась. Морально маршрут тяжёл)
          //
          // Точка №1 (южная): 60.262640, 30.050870 ps уровень лайт+ для взятия потребуется лебедка, мы пользовались единожды при установке. Часть известного маршрута offroad spb.)
          //
          // Точка №2 (южная): 59.97657, 30.60245 ps уровень лайт+
          //
          // Точка №5: 60.209710, 30.170493
          //
          // Точка №6: 60.180511, 30.608303 ps уровень лайт++ исток Морье, для взятия потребуется лебедка, рассудительность и смекалка с большой долей вероятности внд!
          //
          // Точка №7: 60.169574, 30.611350 ps уровень лайт++ точка установлена без использования лебёдки, но это не говорит о том, что она вам не понадобится:)!!!!!! внд скорее всего не поможет.
          // `)
          await this.bot.sendMessage(chatId, `Привет ${user}! Вот список актуальных точек:`)

          // 1 северная
          const oneS = '60.342349, 30.017123'
          const comment1S = 'ps путь к точке уровень лайт, при взятии точки может потребоваться лебедка, нам при установке не потребовалась. Морально маршрут тяжёл'
          const first1S = oneS.split(',')[0].trim()
          const second1S = oneS.split(',')[1].trim()
          await this.bot.sendMessage(chatId, `Точка №1 (северная) ${first1S}, ${second1S} ${comment1S} https://yandex.ru/maps/?ll=${second1S}%2C${first1S}&mode=search&sll=${first1S}%${second1S}&text=${first1S}%2C${second1S}&z=15`)

          // 1 южная
          const oneY = '60.262640, 30.050870'
          const comment1Y = 'ps уровень лайт+ для взятия потребуется лебедка, мы пользовались единожды при установке. Часть известного маршрута offroad spb.)'
          const first1Y = oneY.split(',')[0].trim()
          const second1Y = oneY.split(',')[1].trim()
          await this.bot.sendMessage(chatId, `Точка №1 (южная): ${first1Y}, ${second1Y} ${comment1Y} https://yandex.ru/maps/?ll=${second1Y}%2C${first1Y}&mode=search&sll=${first1Y}%${second1Y}&text=${first1Y}%2C${second1Y}&z=15`)
          // await this.bot.sendMessage(chatId, `https://osmand.net/map/?pin=${first1Y},${second1Y}#9/59.8981/30.2619`)
          // 2 севеная
          const secondS = '60.26690, 30.08947'
          const comment2S = 'ВНИМАНИЕ! Взятие точки очень непростая задача, с собой необходимо иметь запас еды, воды на 2 дня, несколько сменных комплектов одежды!'
          const first2S = secondS.split(',')[0].trim()
          const second2S = secondS.split(',')[1].trim()
          await this.bot.sendMessage(chatId, `Точка №2 (северная): ${first2S}, ${second2S} ${comment2S} https://yandex.ru/maps/?ll=${second2S}%2C${first2S}&mode=search&sll=${first2S}%${second2S}&text=${first2S}%2C${second2S}&z=15`)

          // 2 южная
          const secondY = '59.97657, 30.60245'
          const comment2Y = 'Лайт+'
          const first2Y = secondY.split(',')[0].trim()
          const second2Y = secondY.split(',')[1].trim()
          await this.bot.sendMessage(chatId, `Точка №2 (южная): ${first2Y}, ${second2Y} ${comment2Y} https://yandex.ru/maps/?ll=${second2Y}%2C${first2Y}&mode=search&sll=${first2Y}%${second2Y}&text=${first2Y}%2C${second2Y}&z=15`)

          // точка 5
          const five = '60.209710, 30.170493'
          const comment5 = 'Установлена без фото, брать любым способом, можно тоже без фото, а после установить как положено, с фото. К точке примотан подарок.'
          const first5 = five.split(',')[0].trim()
          const second5 = five.split(',')[1].trim()
          await this.bot.sendMessage(chatId, `Точка №5: ${first5}, ${second5} ${comment5} https://yandex.ru/maps/?ll=${second5}%2C${first5}&mode=search&sll=${first5}%${second5}&text=${first5}%2C${second5}&z=15`)

          // Точка 6
          const six = '60.180511, 30.608303'
          const comment6 = 'ps уровень лайт++ исток Морье, для взятия потребуется лебедка, рассудительность и смекалка с большой долей вероятности внд!'
          const first6 = six.split(',')[0].trim()
          const second6 = six.split(',')[1].trim()
          await this.bot.sendMessage(chatId, `Точка №6: ${first6}, ${second6} ${comment6} https://yandex.ru/maps/?ll=${second6}%2C${first6}&mode=search&sll=${first6}%${second6}&text=${first6}%2C${second6}&z=15`)

          // Точка 7
          const seven = '60.169574, 30.611350'
          const comment7 = 'ps уровень лайт++ точка установлена без использования лебёдки, но это не говорит о том, что она вам не понадобится:)!!!!!! внд скорее всего не поможет.'
          const first7 = seven.split(',')[0].trim()
          const second7 = seven.split(',')[1].trim()
          await this.bot.sendMessage(chatId, `Точка №7: ${first7}, ${second7} ${comment7} https://yandex.ru/maps/?ll=${second7}%2C${first7}&mode=search&sll=${first7}%${second7}&text=${first7}%2C${second7}&z=15`)

          // Кастомная 666
          const six666 = '60.171475, 30.271440'
          const comment666 = ''
          const first666 = six666.split(',')[0].trim()
          const second666 = six666.split(',')[1].trim()
          await this.bot.sendMessage(chatId, `Кастомная Точка №666: ${first666}, ${second666} ${comment666} https://yandex.ru/maps/?ll=${second666}%2C${first666}&mode=search&sll=${first666}%${second666}&text=${first666}%2C${second666}&z=15`)

          // Общая карта всех точек
          await this.bot.sendMessage(chatId, 'Ссылка на карту со всеми точками https://yandex.ru/maps/?ll=30.260584%2C60.190150&mode=usermaps&source=constructorLink&um=constructor%3A835749c06de950dec11aa07d7999866ffd93035133cdbd7b81c7baa0238778ed&z=11.09')

        }

        if (/карта$/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, 'Ссылка на карту со всеми точками https://yandex.ru/maps/?ll=30.260584%2C60.190150&mode=usermaps&source=constructorLink&um=constructor%3A835749c06de950dec11aa07d7999866ffd93035133cdbd7b81c7baa0238778ed&z=11.09')
        }
        // const Point = mongoose.model('Points', {})
        // const point = {
        //   mame: msg.from.first_name,
        //   text: msg.text,
        // }
        // new Point(point).save()
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  stop () {
    if (this.bot) {
      this.bot.stop()
    }
  }
}