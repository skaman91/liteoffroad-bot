import TelegramBot from 'node-telegram-bot-api'
import { MONGO_URL } from './auth/bot.mjs'
import { MongoClient } from 'mongodb'
import { commands, rules } from './const.js'
const client = new MongoClient(MONGO_URL)
await client.connect()
console.log('Connected successfully to db')
const db = client.db('liteoffroad')
const collection = db.collection('points')
const historyCollection = db.collection('historyPoints')
const userCollection = db.collection('users')

let step = 0
let point = ''
let username = ''
let coordinates = ''
let comment = ''
let rating = 0
let install = false

export default class BotLogic {
  constructor ({
    apiToken
  }) {
    this.apiToken = apiToken
    this.bot = null
  }

  async start () {
    if (!this.bot) {
      this.bot = new TelegramBot(this.apiToken, { polling: true })
      console.log('bot', this.bot)
      await this.bot.setMyCommands(commands)
      this.bot.on('message', msg => this.onMessage(msg))
      this.bot.on('photo', msg => this.onFile(msg))
      this.bot.on('callback_query', msg => this.onCallback(msg))
    }
  }

  async onMessage (msg) {
    try {
      if (msg.text) {
        console.log(msg)
        const chatId = msg.chat?.id
        const user = msg?.from.first_name
        if (/^(точки|\/points)$/i.test(msg.text)) {
          const cursor = await collection.find()
          let i = 0
          const points = []

          for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
            i++
            points.push(data)
          }
          await this.bot.sendMessage(chatId, `<b>Привет ${user}!\nВот список актуальных точек:</b>`, { parse_mode: 'HTML' })

          // Точки
          for (const point of points) {
            const name = point.point
            const rating = point.rating
            const comment = point.comment
            const coordinates = point.coordinates
            const first = coordinates?.split(',')[0].trim()
            const second = coordinates?.split(',')[1].trim()
            const photo = point?.photo
            const install = point.install
            const installed = point.installed
            const ratingInfo = install ? `За взятие этой точки вам будет начислен ${rating} балл.` : `@${installed} получит 1 балл, когда установит эту точку`
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\n--------------------------------------`
            // await this.bot.sendLocation(chatId, first, second)
            if (photo) {
              await this.bot.sendPhoto(chatId, photo, {
                caption: text,
                parse_mode: 'HTML',
                disable_notification: true,
                disable_web_page_preview: true
              })
            }
          }

          // Общая карта всех точек
          await this.bot.sendMessage(chatId, `<a href="https://yandex.ru/maps/?ll=30.260584%2C60.190150&mode=usermaps&source=constructorLink&um=constructor%3A835749c06de950dec11aa07d7999866ffd93035133cdbd7b81c7baa0238778ed&z=11.09">Ссылка на карту со всеми точками</a>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }

        if (/карта|\/map$/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, `<a href="https://yandex.ru/maps/?ll=30.260584%2C60.190150&mode=usermaps&source=constructorLink&um=constructor%3A835749c06de950dec11aa07d7999866ffd93035133cdbd7b81c7baa0238778ed&z=11.09">Ссылка на карту со всеми точками</a>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }

        if (/((взял|установил) точку)|(\/take|\/install_point)/i.test(msg.text)) {
          this.defaultData()
          const profile = await userCollection.findOne({ id: msg.from.id })
          if (!profile) {
            await this.bot.sendMessage(chatId, 'Вы не зарегистрированы в боте, на жмите /start и повторите попытку')
            return
          }
          install = /установил точку|\/install_point/i.test(msg.text)
          if (!install) {
            await this.bot.sendMessage(chatId, 'Супер, давай тогда оформим Взятие точки. Я задам несколько вопросов. Постарайся ответить точно, все таки это супер важная инфа 😂')
          } else {
            await this.bot.sendMessage(chatId, 'Супер, давай тогда оформим Установку точки. Я задам несколько вопросов. Постарайся ответить точно, все таки это супер важная инфа 😂')
          }
          await this.bot.sendMessage(chatId, 'Напиши номер точки. Например "точка 5" или "Северная точка 1" или "Кастомная точка 666"')
          step = 1
          return
        }

        if (step === 1 && !point && install) {
          const pointField = /точка [0-9]+/i.test(msg.text)
          if (pointField && !point) {
            point = msg.text
            const pointInBase = await collection.findOne({ point: point })
            if (!pointInBase) {
              await this.bot.sendMessage(chatId, 'Такой точки не существует, возможно вы опечатались')
              return
            }
            console.log('pointInBase.install', pointInBase.install)
            console.log('install', install)
            if (install && pointInBase.install) {
              await this.bot.sendMessage(chatId, 'Точка уже установлена, ее сперва нужно взять')
              return
            }
            await this.bot.sendMessage(chatId, 'Отлично, теперь отправь координаты. Они должны быть в таком формате (без ковычек, просто цифры с запятой посередине) "60.342349, 30.017123"')
            step = 2
            return
          }
        } else if (step === 1 && !install) {
          point = msg.text
          const pointInBase = await collection.findOne({ point: point })
          if (!pointInBase) {
            await this.bot.sendMessage(chatId, 'Такой точки не существует, возможно вы опечатались')
            return
          }
          if (!install && !pointInBase.install) {
            await this.bot.sendMessage(chatId, 'Точка уже взята, ее сперва нужно установить')
            return
          }
          await this.bot.sendMessage(chatId, 'Отправь одну фотографию взятия точки')
          step = 4
        }

        if (step === 2 && point && !coordinates) {
          const coordinatesField = /^(\d\d\.\d{4,}, \d\d\.\d{4,})$/i.test(msg.text)
          if (coordinatesField && !coordinates && install) {
            coordinates = msg.text
            step = 3
            await this.bot.sendMessage(chatId, 'Напиши краткий комментарий к точке, например уровень сложности, рекомендации или что-то такое.')
            return
          } else if (!coordinatesField && !coordinates && install) {
            await this.bot.sendMessage(chatId, 'Формат координат неверный, нужно что бы они были в таком формате "60.342349, 30.017123" (без ковычек, просто цифры с запятой посередине). Если хочешь отменить оформление взятия точки, то напиши "отменить"')

            return
          }
        }

        if (point && coordinates && step === 3) {
          if (!comment) {
            comment = msg.text
            step = 4
            await this.bot.sendMessage(chatId, 'Отправь одну фотографию установки точки')
          }
        }

        if (/^\/profile$/i.test(msg.text)) {
          const id = msg.from.id
          const profile = await userCollection.findOne({ id: id })
          if (profile) {
            const username = msg.from.username
            const firstName = msg.from.first_name
            const rating = profile.rating
            const takePoints = profile.takePoints
            const installPoints = profile.installPoints
            const text = `Username: ${username}\nИмя аккаунта: ${firstName}\nВаш рейтинг: ${rating}\nУстановлено точек: ${installPoints}\nВзято точек: ${takePoints}`
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
          }
        }

        if (/^\/results$/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, 'Раздел в разработке')
          const cursor = await userCollection.find({rating: {$gt : 0}})
          let i = 0
          const resultUsers = []

          for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
            i++
            resultUsers.push(data)
          }
          resultUsers.sort((a, b) => a.rating > b.rating ? -1 : 1)
          for (let i = 0; i <= 10; i++) {
            await this.bot.sendMessage(chatId, `${i + 1} Место @${resultUsers[i].username}\n${resultUsers[i].rating} балл\nВзято ${resultUsers[i].takePoints} точек\nУстановлено ${resultUsers[i].installPoints} точек`, { parse_mode: 'HTML', disable_notification: true })
          }
        }

        if (/^\/archive$/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, 'Раздел в разработке')
          const cursor = await historyCollection.find().limit(30)
          let i = 0
          const points = []

          for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
            i++
            points.push(data)
          }
          await this.bot.sendMessage(chatId, `<b>Привет ${user}!\nВот список последних 30 архивных точек:</b>`, { parse_mode: 'HTML' })
          await this.delay(2000)

          // Архивные Точки
          for (const archivePoint of points) {
            const name = archivePoint.point
            const rating = archivePoint.rating
            const comment = archivePoint.comment
            const coordinates = archivePoint.coordinates
            const first = coordinates?.split(',')[0].trim()
            const second = coordinates?.split(',')[1].trim()
            const photo = archivePoint?.photo
            const install = archivePoint.install
            const installed = archivePoint.installed
            const ratingInfo = `За взятие этой точки было начислено ${rating} балл.`
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed}`
            const date = new Date(archivePoint.takeTimestamp)
            const dateComment = install ? `Точка была установлена ${date.getFullYear()} - ${date.getMonth()+1} - ${date.getDate()}` : `Точка была взята ${date.getFullYear()} - ${date.getMonth()+1} - ${date.getDate()}`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${dateComment}\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\nТочка в архиве, на месте ее НЕТ!!!\n--------------------------------------`
            // await this.bot.sendLocation(chatId, first, second)
            if (photo) {
              await this.bot.sendPhoto(chatId, photo, {
                caption: text,
                parse_mode: 'HTML',
                disable_notification: true,
                disable_web_page_preview: true
              })
            }
          }
        }

        if (msg.text === '/rules') {
          await this.bot.sendMessage(chatId, rules, { parse_mode: 'HTML', disable_notification: true, disable_web_page_preview: true })
        }

        if (/^\/start$/i.test(msg.text)) {
          const username = msg.from.username
          const firstName = msg.from.first_name
          const id = msg.from.id
          const rating = 0
          const takePoints = 0
          const installPoints = 0
          const profile = await userCollection.findOne({ id: id })
          if (!profile) {
            await userCollection.insertOne({
              id: id,
              firstName: firstName,
              username: username,
              rating: rating,
              takePoints: takePoints,
              installPoints: installPoints,
            })
            await this.bot.sendMessage(chatId, 'Вы успешно зарегистрированы')
          }
        }

      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async onCallback (msg) {
    try {
      console.log('msg', msg)
      switch (msg.data) {
        case 'tookPoints': { // забрал
          break
        }
        case 'leftItThere': { // оставил
          await collection.updateOne({ point: point }, { $inc: { rating: 1, }})
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async onFile (msg) {
    try {
      const file = msg.photo[0].file_id
      const chatId = msg.from.id
      const pointField = await collection.findOne({ point: point })
      if (step === 4 && file) {
        const text = install
          ? 'Отлично, этого достаточно. За установку этой точки, тебе начислен 1 балл'
          : `Отлично, этого достаточно. За взятие этой точки, тебе начислен ${pointField.rating} балл`
        await this.bot.sendMessage(chatId, text)
        rating = pointField.rating
      } else {
        return
      }
      const profile = await userCollection.findOne({ id: msg.from.id })
      const text = install
        ? `${point} Установлена!🔥\nКоординаты: <code>${coordinates}</code>\nУстановил: @${msg.from.username}\n${comment}\nТебе добавлен рейтинг +1\nОбщий рейтинг ${profile.rating}`
        : `${point} Взята 🔥\n${comment}\nТочку взял: @${msg.from.username}\nТебе добавлен рейтинг +${rating}\nОбщий рейтинг ${profile.rating}`
      await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
      await this.bot.sendPhoto(chatId, file)

      if (pointField) {
        if (install) {
          await historyCollection.insertOne({
            point: pointField.point,
            comment: pointField.comment,
            coordinates: pointField.coordinates,
            install: true,
            installed: msg.from.username,
            photo: pointField.photo,
            rating: pointField.rating,
            takeTimestamp: new Date().getTime()
          })
        } else {
          await historyCollection.insertOne({
            point: pointField.point,
            comment: pointField.comment,
            coordinates: pointField.coordinates,
            install: false,
            installed: msg.from.username,
            photo: pointField.photo,
            rating: pointField.rating,
            takeTimestamp: new Date().getTime()
          })
        }

        await userCollection.updateOne({ username: msg.from.username }, {
          $inc: {
            rating: rating,
            installPoints: install ? 1 : 0,
            takePoints: !install ? 1 : 0
          }
        })

        await collection.updateOne({ point: point }, {
          $set: {
            install: install,
            coordinates: install ? coordinates : ',',
            comment: comment,
            photo: file,
            rating: 1,
            takeTimestamp: new Date().getTime()
          }
        })
        if (!install) {
          await this.bot.sendMessage(chatId, `Точка осталась на месте или забрал?`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Оставил', callback_data: 'leftItThere' }, { text: 'Забрал', callback_data: 'tookPoints' }]
              ]
            }
          })
        } else {
          this.defaultData()
        }
      } else {
        await this.bot.sendMessage(chatId, 'Такая точка не найдена')
      }
    } catch (e) {
      console.log('Failed onFile', e.message)
    }
  }

  delay (minDelay, maxDelay) {
    const timeout = maxDelay ? ~~((minDelay + (maxDelay - minDelay) * Math.random())) : minDelay

    return new Promise(resolve => setTimeout(resolve, timeout))
  }

  defaultData () {
    step = 0
    point = ''
    username = ''
    coordinates = ''
    comment = ''
    rating = 0
    install = false
  }

  stop () {
    if (this.bot) {
      this.bot.stop()
    }
  }
}