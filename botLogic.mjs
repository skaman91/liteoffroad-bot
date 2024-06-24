import TelegramBot from 'node-telegram-bot-api'
import mongoose, { Mongoose } from 'mongoose'
import { DB } from './auth/bot.mjs'
import { MongoClient } from 'mongodb'
import { commands } from './const.js'

const url = 'mongodb+srv://skaman93:kadha7-Qyrrit-hisfer@cluster0.qn6jtl9.mongodb.net/?'
const client = new MongoClient(url)
await client.connect()
console.log('Connected successfully to db')
const db = client.db('liteoffroad')
const collection = db.collection('points')
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
      this.bot.setMyCommands(commands)
      this.bot.on('message', msg => this.onMessage(msg))
      this.bot.on('photo', msg => this.onFile(msg))
    }
  }

  async onMessage (msg) {
    try {
      if (msg.text) {
        console.log(msg)
        const chatId = msg.chat?.id
        const user = msg?.from.first_name
        if (/^(точки|\/points)$/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, `<b>Привет ${user}!\nВот список актуальных точек:</b>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })

          // 1 северная
          const oneS = await collection.findOne({ point: 'Точка 1 северная'} )   // '60.342349, 30.017123'
          if (oneS) {
            const name = oneS.point
            const rating = oneS.rating
            const comment = oneS.comment
            const coordinates = oneS.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = oneS.photo
            const install = oneS.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = oneS.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
          }

          // 1 южная
          const oneY = await collection.findOne({ point: 'Точка 1 южная'} )   // '60.342349, 30.017123'
          if (oneY) {
            const name = oneY.point
            const rating = oneY.rating
            const comment = oneY.comment
            const coordinates = oneY.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = oneY.photo
            const install = oneY.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = oneY.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
            // await this.bot.sendMessage(chatId, `https://osmand.net/map/?pin=${first1Y},${second1Y}#9/59.8981/30.2619`)
          }

          // 2 северная
          const secondS = await collection.findOne({ point: 'Точка 2 северная'})
          if (secondS) {
            const name = secondS.point
            const rating = secondS.rating
            const comment = secondS.comment
            const coordinates = secondS.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = secondS.photo
            const install = secondS.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = secondS.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
          }

          // 2 южная
          const secondY = await collection.findOne({ point: 'Точка 2 южная'}) // '59.97657, 30.60245' 'Лайт+'
          if (secondY) {
            const name = secondY.point
            const rating = secondY.rating
            const comment = secondY.comment
            const coordinates = secondY.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = secondY.photo
            const install = secondY.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = secondY.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
          }

          // точка 5
          const five = await collection.findOne({ point: 'Точка 5'}) // '59.97657, 30.60245' 'Лайт+'
          if (five) {
            const name = five.point
            const rating = five.rating
            const comment = five.comment
            const coordinates = five.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = five.photo
            const install = five.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = five.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
          }

          // Точка 6
          const six= await collection.findOne({ point: 'Точка 6'})
          if (six) {
            const name = six.point
            const rating = six.rating
            const comment = six.comment
            const coordinates = six.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = six.photo
            const install = six.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = six.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
          }

          // Точка 7
          const seven= await collection.findOne({ point: 'Точка 7'})
          if (seven) {
            const name = seven.point
            const rating = seven.rating
            const comment = seven.comment
            const coordinates = seven.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = seven.photo
            const install = seven.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = seven.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
          }

          // Точка 8
          const eight= await collection.findOne({ point: 'Точка 8'})
          if (eight) {
            const name = eight.point
            const rating = eight.rating
            const comment = eight.comment
            const coordinates = eight.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = eight.photo
            const install = eight.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = eight.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
          }

          // Кастомная 666
          const six666 = '60.171475, 30.271440'
          const comment666 = ''
          const first666 = six666.split(',')[0].trim()
          const second666 = six666.split(',')[1].trim()
          const text666 = `<b>Кастомная Точка №666</b>\n<code>${first666}, ${second666}</code>\n<a href="https://yandex.ru/maps/?ll=${second666}%2C${first666}&mode=search&sll=${first666}%${second666}&text=${first666}%2C${second666}&z=15">Посмотреть на карте</a>\n${comment666}\n--------------------------------------`
          await this.bot.sendMessage(chatId, text666, { parse_mode: 'HTML', disable_web_page_preview: true })

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
            await this.bot.sendMessage(chatId, 'Отлично, теперь отправь координаты, постарайся что бы они были в таком формате (без ковычек, просто цифры с запятой посередине) "60.342349, 30.017123" ')
            step = 2
            return
          }
        } else if (step === 1 && !install) {
          point = msg.text
          await this.bot.sendMessage(chatId, 'Отправь одну фотографию взятия точки')
          console.log('point', point)
          step = 4
        }

        if (step === 2 && point && !coordinates) {
          const coordinatesField = /(\d+\.\d{4,}, \d+\.\d{4,})/i.test(msg.text)
          if (coordinatesField && !coordinates && install) {
            coordinates = msg.text
            step = 3
            await this.bot.sendMessage(chatId, 'Напиши краткий комментарий к точке, например уровень сложности, рекомендации или что-то такое.')
            return
          } else if (!coordinatesField && !coordinates && install) {
            await this.bot.sendMessage(chatId, 'Формат координат не верный, нужно что бы они были в таком формате "60.342349, 30.017123" (без ковычек, просто цифры с запятой посередине). Если хочешь отменить оформление взятия точки, то напиши "отменить"')

            return
          }
        }

        if (point && coordinates && step === 3) {
          if (!comment) {
            comment = msg.text
            console.log('username', username)
            console.log('point', point)
            console.log('coordinates', coordinates)
            console.log('comment', comment)
            step = 4
            await this.bot.sendMessage(chatId, 'Отправь одну фотографию взятия точки')
          }
        }

        if (/\/rofile/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, 'Раздел в разработке')
        }

        if (/\/results/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, 'Раздел в разработке')
        }
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async onFile (msg) {
    console.log('msg', msg)
    const file = msg.photo[0].file_id
    const chatId = msg.from.id
    if (step === 4 && file) {
      await this.bot.sendMessage(chatId, 'Отлично, этого достаточно. За установку этой точки, тебе начислен один балл))')
      rating = 1
      step = 5
    } else {
      return
    }

    const text = install
      ? `${point} Установлена!🔥\nКоординаты: <code>${coordinates}</code>\nУстановил: @${msg.from.username}\n${comment}\nТебе добавлен рейтинг +${rating}\nОбщий рейтинг 100500`
      : `${point} Взята 🔥\n${comment}\nТочку взял: @${msg.from.username}\nТебе добавлен рейтинг +${rating}\nОбщий рейтинг 100500`
    await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
    await this.bot.sendPhoto(chatId, file)
    await collection.updateOne({point: point}, {$set: {
        coordinates: coordinates,
        comment: comment,
        rating: rating,
        install: install,
        installed: msg.from.username,
        photo: file
      }})

    await collection.insertOne({})
    step = 0
    point = ''
    username = ''
    coordinates = ''
    comment = ''
    rating = 0
  }

  stop () {
    if (this.bot) {
      this.bot.stop()
    }
  }
}