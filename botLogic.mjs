import TelegramBot from 'node-telegram-bot-api'
import 'dotenv/config'
import { CITIES } from './auth/bot.mjs'
import { MongoClient } from 'mongodb'
import { commands, rules1, rules2, adminCommands } from './const.js'
import cron from 'node-cron'
import * as turf from '@turf/turf'
// import { gameZones } from './zones.js'

const MONGO_URL = process.env.MONGO_URL
const client = new MongoClient(MONGO_URL)
await client.connect()
console.log('Connected successfully to db')
const db = client.db('liteoffroad')
const collection = db.collection('points')
const historyCollection = db.collection('historyPoints')
const userCollection = db.collection('users')
const stateCollection = db.collection('state')
const ADMIN = process.env.ADMIN
const CHANEL_LITEOFFROAD = process.env.CHANEL_LITEOFFROAD
const TESTCHANEL_ID_LITEOFFROAD = process.env.TESTCHANEL_ID_LITEOFFROAD
let eventStarting = false
// let eventStage = ''
// await this.loadBotState()

const usersMap = {}

export default class BotLogic {
  constructor ({
    apiToken
  }) {
    this.apiToken = apiToken
    this.bot = null
    this.init()
  }

  async init () {
    await this.loadBotState()
  }

  async loadBotState () {
    const state = await stateCollection.findOne({ key: 'eventStarting' })
    // const stage = await stateCollection.findOne({ key: 'eventStage' })

    if (state) {
      eventStarting = state.value
      // eventStage = state.value
      console.log(`Loaded eventStarting: ${eventStarting}`)
    } else {
      // Если записи нет — создаем новую с eventStarting: false
      await stateCollection.insertOne({ key: 'eventStarting', value: false })
      eventStarting = false
      console.log('State not found, initialized with eventStarting: false')
    }
  }

  async start () {
    if (!this.bot) {
      this.bot = new TelegramBot(this.apiToken, { polling: true })
      console.log('bot started')
      await this.bot.setMyCommands(commands)
      this.bot.on('message', msg => this.onMessage(msg))
      this.bot.on('channel_post', msg => this.onChannelPost(msg))
      this.bot.on('photo', msg => this.onFile(msg))
      this.bot.on('callback_query', msg => this.onCallback(msg))

      cron.schedule('0 */3 * * *', () => {
        this.updatePointsRating().then(() => console.log(``))
      })
      cron.schedule('* * * * *', () => {
        this.checkInstallPoints()
      })
    }
  }

  async onChannelPost (msg) {
    console.log('msg', msg)
  }

  async onMessage (msg) {
    try {
      if (msg.text) {
        console.log(this.getTime())
        console.log('Сообщение:', msg.text, 'userName:', msg?.from.username ? `@${msg?.from.username}` : '', 'first_name:', msg?.from.first_name)
        const profile = await userCollection.findOne({ id: msg.from.id })
        const chatId = msg.chat?.id
        const user = msg?.from.first_name
        const userName = msg?.from.username ? `@${msg?.from.username}` : ''
        const userId = msg?.from.id

        if (!profile && msg.text === '/start') {
          await this.registration(msg)
          return
        }

        if (profile && msg.text === '/start') {
          await this.bot.sendMessage(chatId, 'Вы уже зарегистрированы')
          return
        }

        if (!usersMap[chatId]) {
          usersMap[chatId] = {
            username: userName,
            firstName: user,
            userId,
            step: 0,
            point: '',
            coordinates: '',
            comment: '',
            rating: 0,
            install: false,
            photo: '',
            waitingForResponse: false,
            city: profile?.city || '',
            textForChanel: '',
            textForChatId: '',
            takenPoints: profile?.takenPoints || [],
            noInstallPoints: profile.noInstallPoints
          }
        }

        usersMap[chatId].city = profile?.city || ''

        // console.log('usersMap[chatId]', usersMap[chatId])
        if (!profile && msg.text !== '/start') {
          await this.bot.sendMessage(chatId, `Вам нужно зарегистрироваться, для регистрации нажмите /start`)
          return
        }

        if (profile && profile.banned) {
          await this.bot.sendMessage(chatId, `Вам запрещено пользоваться ботом`)
          return
        }
        if (msg.text === '/points') {
          const cursor = await collection.find({ city: usersMap[chatId].city })
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
            if (name === 'Точка 88' && !ADMIN.includes(userId)) {
              continue
            }
            const rating = point.rating
            const comment = point.comment

            if (comment === 'точку украли') {
              continue
            }

            const coordinates = point.coordinates
            const first = coordinates?.split(',')[0]?.trim()
            const second = coordinates?.split(',')[1]?.trim()
            const photo = point?.photo
            const rang = point.rang === 'Хард' ? '🔴Хард' : '🟢Лайт'
            const install = point.install
            const installed = point.installed
            const osmAndLink = `<a href="https://osmand.net/map?pin=${first},${second}#13/${first}/${second}">Открыть в OsmAnd</a>`
            const ratingInfo = install ? `За взятие этой точки вам будет начислен ${rating} ${this.declOfNum(rating, 'балл')}.` : `${installed} получит 2 балла, когда установит эту точку`
            const installedComment = install ? `Установил ${installed}` : `Точку взял ${installed} и еще не установил`
            const takers = point.takers ? point?.takers?.join(', ') : []
            const installComment = install ? 'установлена' : 'взята'
            const installedDays = `Точка ${installComment} ${this.getDaysSinceInstallation(point.takeTimestamp)} ${this.declOfNum(this.getDaysSinceInstallation(point.takeTimestamp), 'дней')} назад`
            const text = !takers.length
              ? `<b>${rang || ''} ${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\n${installedDays}\n${osmAndLink}\n--------------------------------------`
              : `<b>${rang || ''} ${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\nТочку брали, но оставили на месте: ${takers}\n${installedDays}\n${osmAndLink}\n--------------------------------------`
            // await this.bot.sendLocation(chatId, first, second)
            if (photo) {
              await this.bot.sendPhoto(chatId, photo, {
                caption: text,
                parse_mode: 'HTML',
                disable_notification: true,
                disable_web_page_preview: true
              })
            } else {
              await this.bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                disable_notification: true,
                disable_web_page_preview: true
              })
            }
          }

          // Общая карта всех точек
          await this.bot.sendMessage(chatId, `<a href="https://point-map.ru/">Ссылка на карту со всеми точками</a>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }

        if (msg.text === '/map') {
          await this.bot.sendMessage(chatId, `<a href="https://point-map.ru/">Ссылка на карту со всеми точками</a>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }

        if (/(\/take|\/install)/i.test(msg.text)) {
          await this.defaultData(chatId)
          const profile = await userCollection.findOne({ id: msg.from.id })
          if (!profile) {
            await this.bot.sendMessage(chatId, 'Вы не зарегистрированы в боте, на жмите /start и повторите попытку')
            return
          }
          usersMap[chatId].install = /\/install/i.test(msg.text)
          if (!usersMap[chatId].install) {
            await this.bot.sendMessage(chatId, 'Супер, давай тогда оформим Взятие точки. Я задам несколько вопросов. Постарайся ответить точно, все таки это супер важная инфа 😎')
          } else {
            await this.bot.sendMessage(chatId, 'Супер, давай тогда оформим Установку точки. Я задам несколько вопросов. Постарайся ответить точно, все таки это супер важная инфа 😎')
          }
          const results = await collection
            .find({
              city: usersMap[chatId].city,
              comment: { $ne: 'точку украли' },
            })
            .limit(50)
            .toArray()
          if (results.length === 0) {
            return await this.bot.sendMessage(chatId, 'Нет доступных точек для выбора.')
          }

          const buttons = results
            .filter(point => point.point)
            .map(point => {
              const displayText = point.point.replace(/Точка\s*/i, '').trim()
              let callbackData = `Точка_${displayText.replace(/\s+/g, '_')}`

              return { text: displayText, callback_data: callbackData }
            })
          const inlineKeyboard = []
          for (let i = 0; i < buttons.length; i += 2) {
            inlineKeyboard.push(buttons.slice(i, i + 2))
          }

          await this.bot.sendMessage(chatId, 'Какой номер точки?', {
            reply_markup: { inline_keyboard: inlineKeyboard }
          })
          usersMap[chatId].step = 1
          return
        }

        if (usersMap[chatId].step === 2 && usersMap[chatId].point && !usersMap[chatId].coordinates && usersMap[chatId].install) {
          const coordinates = this.parseCoordinates(msg.text)
          console.log('input coordinates', msg.text)
          console.log('formated coordinates', coordinates)
          // this.checkCoordinatesArea(coordinates)

          if (coordinates && !usersMap[chatId].coordinates && usersMap[chatId].install) {
            usersMap[chatId].coordinates = coordinates
            usersMap[chatId].step = 3
            await this.bot.sendMessage(chatId, 'Напиши краткий комментарий к точке, например уровень сложности, рекомендации или что-то такое.')
            return
          } else if (!coordinates && !usersMap[chatId].coordinates && usersMap[chatId].install) {
            await this.bot.sendMessage(chatId, 'Формат координат неверный, нужно что бы они были в таком формате "60.342349, 30.017123" (без кавычек, просто цифры с запятой посередине). Если хочешь отменить оформление взятия точки, то напиши "отменить"')

            return
          }
        }
        if (!usersMap[chatId].install && usersMap[chatId].step === 3) {
          if (!usersMap[chatId].comment) {
            usersMap[chatId].step = 4
            usersMap[chatId].comment = msg.text
            await this.bot.sendMessage(chatId, 'Отправь ОДНУ!!! фотографию взятия точки')
            return
          }
        }

        if ((usersMap[chatId].point && usersMap[chatId].coordinates && usersMap[chatId].step === 3) || usersMap[chatId].step === 3 && !usersMap[chatId].install) {
          if (!usersMap[chatId].comment) {
            usersMap[chatId].comment = msg.text
            usersMap[chatId].step = 4
            await this.bot.sendMessage(chatId, 'Отправь ОДНУ!!! фотографию установки точки')
          }
        }

        if (/^\/profile$/i.test(msg.text)) {
          const id = msg.from.id
          const chatId = msg.from.id
          await this.defaultData(chatId)
          const profile = await userCollection.findOne({ id: id })
          if (profile) {
            const username = msg.from.username
            const firstName = msg.from.first_name
            const rating = profile.rating
            const position = profile.position
            const takePoints = profile.takePoints
            const installPoints = profile.installPoints
            const city = profile.city ? profile.city : 'Город не выбран'
            const text = `Username: ${username}\nИмя аккаунта: ${firstName}\nВаш рейтинг: ${rating}\nВаше место в рейтинге: ${position}\nУстановлено точек: ${installPoints}\nВзято точек: ${takePoints}\nВаш город: ${city}`
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
          }
        }

        if (/^\/results$/i.test(msg.text)) {
          try {
            const chatId = msg.from.id
            await this.defaultData(chatId)
            const res = await this.ratingCursor()
            const resultUsers = res.result

            if (!resultUsers.length) {
              await this.bot.sendMessage(chatId, `Еще нет лидеров, игра только началась`)
              return
            }

            let message = '<b>Общие результаты игры</b>'
            const maxLength = 4000 // Лимит символов в одном сообщении
            let messages = [] // Массив для хранения частей

            for (let i = 0; i < resultUsers.length; i++) {
              const username = resultUsers[i].username
                ? `@${resultUsers[i].username}`
                : `<a href="tg://user?id=${resultUsers[i].id}">${resultUsers[i].firstName}</a>`

              const date = new Date(resultUsers[i].positionTime)
              const now = new Date()
              const diffInMs = now - date
              const daysDiff = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
              const hoursDiff = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
              const minutesDiff = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60))

              const ratingText = daysDiff
                ? `На ${resultUsers[i].position} месте уже ${daysDiff} ${this.declOfNum(daysDiff, 'дней')}, ${hoursDiff} ${this.declOfNum(hoursDiff, 'час')} и ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`
                : hoursDiff
                  ? `На ${resultUsers[i].position} месте уже ${hoursDiff} ${this.declOfNum(hoursDiff, 'час')} и ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`
                  : `На ${resultUsers[i].position} месте уже ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`

              let entry = `\n--------------------------------------\n`
              entry += `<b>${resultUsers[i]?.position} Место</b> ${username} ${resultUsers[i]?.winner}\n`
              entry += `${resultUsers[i].rating} ${this.declOfNum(resultUsers[i].rating, 'балл')}\n`
              entry += `Взято точек: ${resultUsers[i].takePoints}\n`
              entry += `Установлено точек: ${resultUsers[i].installPoints}\n`
              entry += `${ratingText}`

              if ((message + entry).length > maxLength) {
                messages.push(message) // Добавляем сформированную часть
                message = '' // Очищаем буфер
              }

              message += entry
            }

            // Добавляем оставшуюся часть, если она не пустая
            if (message) {
              messages.push(message)
            }

            // Отправляем все части сообщений
            for (const msgPart of messages) {
              await this.bot.sendMessage(chatId, msgPart, {
                parse_mode: 'HTML',
                disable_notification: true
              })
            }

          } catch (e) {
            console.error('Failed results', e.message)
          }
        }

        if (/^\/eventresults|\/start eventresults$/i.test(msg.text)) {
          try {
            const chatId = msg.from.id
            await this.defaultData(chatId)
            if (!eventStarting) {
              await this.bot.sendMessage(chatId, `Этап сейчас не проводится`)
              return
            }
            const res = await this.ratingCursor()
            const eventResult = res.eventResult

            if (!eventResult.length) {
              await this.bot.sendMessage(chatId, `Еще нет лидеров, игра только началась`)
              return
            }

            let messages = []
            let message = '<b>Результаты текущего этапа</b>\n'

            for (let i = 0; i < eventResult.length; i++) {
              const username = eventResult[i].username
                ? `@${eventResult[i].username}`
                : `<a href="tg://user?id=${eventResult[i].id}">${eventResult[i].firstName}</a>`

              const date = new Date(eventResult[i].event.eventPositionTime)
              const now = new Date()
              const diffInMs = now - date
              const daysDiff = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
              const hoursDiff = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
              const minutesDiff = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60))

              const ratingText = daysDiff
                ? `На ${eventResult[i].event.eventPosition} месте уже ${daysDiff} ${this.declOfNum(daysDiff, 'дней')}, ${hoursDiff} ${this.declOfNum(hoursDiff, 'час')} и ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`
                : hoursDiff
                  ? `На ${eventResult[i].event.eventPosition} месте уже ${hoursDiff} ${this.declOfNum(hoursDiff, 'час')} и ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`
                  : `На ${eventResult[i].event.eventPosition} месте уже ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`

              let entry = `-------------------------------------\n`
              entry += `<b>${eventResult[i].event.eventPosition} Место</b> ${username}\n`
              entry += `${eventResult[i].event.rating} ${this.declOfNum(eventResult[i].event.rating, 'балл')}\n`
              entry += `Взято точек: ${eventResult[i].event.eventTakePoints}\n`
              entry += `Установлено точек: ${eventResult[i].event.eventInstallPoints}\n`
              entry += `${ratingText}\n`

              if ((message.length + entry.length) > 4000) {
                messages.push(message)
                message = entry // Начинаем новое сообщение
              } else {
                message += entry
              }
            }

            messages.push(message) // Добавляем последнее сообщение

            for (const msgPart of messages) {
              await this.bot.sendMessage(chatId, msgPart, {
                parse_mode: 'HTML',
                disable_notification: true
              })
            }
          } catch (e) {
            console.error('Failed results', e.message)
          }
        }

        if (/^\/archive$/i.test(msg.text)) {
          try {
            const chatId = msg.from.id
            await this.defaultData(chatId)
            const cursor = await historyCollection
              .find({ city: usersMap[chatId].city })
              .sort({ _id: -1 })
              .limit(20)
            let i = 0
            const points = []

            for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
              i++
              points.push(data)
            }
            if (points.length) {
              await this.bot.sendMessage(chatId, `<b>Привет ${user}!\nВот список последних 20 архивных точек:</b>`, { parse_mode: 'HTML' })
            } else {
              await this.bot.sendMessage(chatId, `<b>Привет ${user}!\nНе нашлось архивных точек:</b>`, { parse_mode: 'HTML' })
            }
            await this.delay(2000)

            // Архивные Точки
            for (const archivePoint of points) {
              const name = archivePoint.point
              if (name === 'Точка 88' && !ADMIN.includes(userId)) {
                continue
              }
              const rating = archivePoint.rating
              const comment = archivePoint.comment
              const coordinates = archivePoint.coordinates
              const first = coordinates?.split(',')[0].trim()
              const second = coordinates?.split(',')[1].trim()
              const photo = archivePoint?.photo
              const install = archivePoint.install
              const installed = archivePoint.installed
              const id = ADMIN.includes(userId) ? `                  id: ${archivePoint.id}` : ''
              const ratingInfo = `За взятие этой точки было начислено ${rating} ${this.declOfNum(rating, 'балл')}.`
              const installedComment = install ? `Установил ${installed}` : `Точку взял ${installed}`
              const date = new Date(archivePoint.takeTimestamp)
              const dateComment = install ? `Точка была установлена ${date.getFullYear()} - ${date.getMonth() + 1} - ${date.getDate()}` : `Точка была взята ${date.getFullYear()} - ${date.getMonth() + 1} - ${date.getDate()}`
              const historyTakers = archivePoint.takers?.join(', ')
              const text = !historyTakers
                ? `<b>${name}</b>${id}\n<code>${coordinates}</code>\n${dateComment}\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\n--------------------------------------`
                : `<b>${name}</b>${id}\n<code>${coordinates}</code>\n${dateComment}\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\nТочку брали, но оставили на месте: ${historyTakers}\n--------------------------------------`
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
          } catch (e) {
            console.log('Faled Archive', e)
          }
        }

        if (msg.text === '/rules') {
          const chatId = msg.from.id
          await this.defaultData(chatId)
          await this.bot.sendMessage(chatId, rules1, {
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
          })
          await this.bot.sendMessage(chatId, rules2, {
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
          })
        }

        // ADMIN
        if (/команды/i.test(msg.text) && ADMIN.includes(userId)) {
          await this.bot.sendMessage(chatId, adminCommands, { parse_mode: 'HTML' })
        }

        if (/вернуть \d+/i.test(msg.text) && ADMIN.includes(userId)) {
          const backPoint = msg.text.split(' ')[1].trim()
          await this.bot.sendMessage(chatId, `Возвращаю точку id: ${backPoint}`)
          const profile = await historyCollection.findOne({ id: parseInt(backPoint) })
          console.log('backPoint', backPoint)
          console.log('profile', profile)
          if (!profile) {
            await this.bot.sendMessage(chatId, 'Точка с таким id не найдена')
            return
          }
          await collection.updateOne({ point: profile.point }, {
            $set: {
              id: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
              install: !profile.install,
              coordinates: profile.coordinates,
              comment: profile.comment,
              photo: profile.photo,
              installed: profile.installed,
              installedId: profile.installedId,
              rating: profile.rating,
              city: profile.city,
              takeTimestamp: profile.takeTimestamp,
              updateTimestamp: profile.updateTimestamp
            }
          })
          // todo Сделать коррекцию рейтинга при переносе
          await this.bot.sendMessage(chatId, 'Готово')
        }

        if (/правка/i.test(msg.text) && ADMIN.includes(userId)) {
          // выполнить какое нибудь действие админом
          const coord = msg.text.split('|')[1].trim()
          console.log('coord', coord)
          this.checkCoordinatesArea(coord)
        }

        if (/обновить рейтинг этапа|игры/i.test(msg.text) && ADMIN.includes(userId)) {
          await this.refreshRating()
        }

        if (/Добавить точку/i.test(msg.text) && ADMIN.includes(userId)) { // Добавить точку 22 Лайт Санкт-Петербург
          try {
            // выполнить какое нибудь действие админом
            const pointName = `Точка ${msg.text.split(' ')[2].trim()}`
            const rang = msg.text.split(' ')[3].trim()
            const city = msg.text.split(' ')[4].trim()
            const checkPoint = await collection.findOne({ point: pointName, city: city })
            if (!checkPoint) {
              await collection.insertOne({
                point: pointName,
                coordinates: ',',
                comment: 'Новая точка, еще не устанавливалась',
                rating: 1,
                install: false,
                installed: '',
                photo: '',
                takers: [],
                id: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
                takeTimestamp: Date.now(),
                updateTimestamp: Date.now(),
                rang,
                installedId: null,
                city
              })
              await this.bot.sendMessage(chatId, `${pointName} Добавлена. \nгород ${city}`, { parse_mode: 'HTML' })
              return
            } else {
              await this.bot.sendMessage(chatId, `Эта точка уже существует`, { parse_mode: 'HTML' })
              console.log('checkPoint', checkPoint)
            }
          } catch (e) {
            console.error('Ошибка добавления новой точки', e.message)
          }
        }

        if (/забанить /i.test(msg.text) && ADMIN.includes(userId)) {
          const banUser = msg.text.split(' ')[1].trim()
          await userCollection.updateOne({ username: banUser }, { $set: { 'banned': true } })
          await this.bot.sendMessage(chatId, `Пользователь ${banUser} забанен`)
        }
        if (/разбанить /i.test(msg.text) && ADMIN.includes(userId)) {
          const banUser = msg.text.split(' ')[1].trim()
          await userCollection.updateOne({ username: banUser }, { $set: { 'banned': false } })
          await this.bot.sendMessage(chatId, `Пользователь ${banUser} разбанен`)
        }

        // ADMIN старт этапа
        if (/\d+ этап старт/i.test(msg.text) && ADMIN.includes(userId)) { // 2 этап старт Санкт-Петербург
          const eventNumber = msg.text.split(' ')[0].trim()
          console.log('eventNumber', eventNumber)
          const cityEvent = msg.text.split(' ')[3].trim()
          console.log('cityEvent', cityEvent)
          await userCollection.updateMany(
            { city: cityEvent },
            {
              $set: {
                event: {
                  eventInstallPoints: 0,
                  eventTakePoints: 0,
                  rating: 0,
                  eventPosition: 0,
                  eventPositionTime: new Date().getTime()
                }
              }
            }
          )
          await this.bot.sendMessage(CHANEL_LITEOFFROAD, `❗❗❗Внимание! Стартует ${eventNumber} этап игры! Всем удачи! Этап будет завершен 1 апреля в 00:00❗❗❗`)
          eventStarting = true
          await this.setEventStarting(eventStarting)
          return
        }

        // ADMIN стоп этапа
        if (/\d+ этап стоп/i.test(msg.text) && ADMIN.includes(userId)) { // 2 этап стоп Санкт-Петербург
          const eventNumber = msg.text.split(' ')[0].trim()
          const cityEvent = msg.text.split(' ')[3].trim()
          await this.bot.sendMessage(CHANEL_LITEOFFROAD, `❗❗❗Внимание! Окончен ${eventNumber} этап игры!❗❗❗`)
          eventStarting = false
          await this.setEventStarting(eventStarting)
          return
        }

        // help
        if (/\/help/i.test(msg.text)) {
          const chatId = msg.from.id
          await this.defaultData(chatId)
          const userId = usersMap[chatId].userId
          const username = usersMap[chatId].username ? `${usersMap[chatId].username}` : `<a href="tg://user?id=${userId}">${usersMap[chatId].firstName}</a>`
          await this.bot.sendMessage(chatId, `Привет, ${username}! Что случилось? Ваше сообщение будет отправлено в канал @liteoffroad всем пользователям. Отправьте координаты где вы застряли и напишите комментарий. Если позволяет интеренет, то отправьте фото и видео бедствия в комментарии к посту в канале.`, {
            reply_markup: {
              keyboard: [['❌ Отмена']],
              one_time_keyboard: true,
              resize_keyboard: true
            },
            parse_mode: 'HTML'
          })
          usersMap[chatId].waitingForResponse = true
          return
        }
        // help
        if (msg.text === '❌ Отмена' && usersMap[chatId].waitingForResponse) {
          await this.bot.sendMessage(chatId, 'Запрос отменен.', {
            reply_markup: { remove_keyboard: true }
          })
          usersMap[chatId].waitingForResponse = false
        }
        // help
        if (usersMap[chatId].waitingForResponse) {
          const userName = usersMap[chatId].username ? `${usersMap[chatId].username}` : `<a href="tg://user?id=${userId}">${usersMap[chatId].firstName}</a>`

          if (msg.text) {
            await this.bot.sendMessage(chatId, 'Ваш запрос отправлен в общий канал @liteoffroad!', {
              reply_markup: { remove_keyboard: true }
            })
            const text = `🚨ВНИМАНИЕ СОС!!!\n ${userName} требуется помощь:\n\n${msg.text}`
            await this.bot.sendMessage(CHANEL_LITEOFFROAD, text, {
              parse_mode: 'HTML'
            })

          }

          usersMap[chatId].waitingForResponse = false
        }

        if (/\/changeCity/i.test(msg.text)) {
          const chatId = msg.from.id
          await this.defaultData(chatId)
          const userCity = await this.getUserCity(chatId)
          console.log('user', user)
          console.log('Ваш город -', userCity)
          await this.bot.sendMessage(chatId, `🏙 Ваш текущий город: \n*${userCity}*\n\nХотите сменить город?`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Да, сменить город', callback_data: 'change_city' }],
                [{ text: 'Нет', callback_data: 'cancel' }]
              ]
            }
          })
        }
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  parseCoordinates (input) {
    input = input.trim().replace(/[^\d.,°′″ NSEW+\-]/g, '') // Удаляем лишние символы

    // Если уже в правильном формате
    let decimalMatch = input.match(/^([+\-]?\d{1,3}\.\d+),?\s*([+\-]?\d{1,3}\.\d+)$/)
    if (decimalMatch) {
      return `${parseFloat(decimalMatch[1]).toFixed(6)}, ${parseFloat(decimalMatch[2]).toFixed(6)}`
    }

    // Обработка формата с градусами, минутами и секундами
    let dmsMatch = input.match(/(\d{1,3})°(\d{1,2})′(\d{1,2}(?:\.\d+)?)″?\s*([NSEW])/g)
    if (dmsMatch && dmsMatch.length === 2) {
      let coords = dmsMatch.map(dms => {
        let [, deg, min, sec, dir] = dms.match(/(\d{1,3})°(\d{1,2})′(\d{1,2}(?:\.\d+)?)″?\s*([NSEW])/)
        let decimal = parseInt(deg) + parseInt(min) / 60 + parseFloat(sec) / 3600
        if (dir === 'S' || dir === 'W') decimal *= -1
        return decimal.toFixed(5)
      })
      return `${coords[0]}, ${coords[1]}`
    }

    return null
  }

  checkCoordinatesArea (input) {
    const polygonCoordinates = [
      [29.948576019403, 60.2476041405961],
      [29.9401646119323, 60.2351644124971],
      [29.9968128663268, 60.2187128636216],
      [30.0136356812682, 60.2419812869151],
      [29.9724369507995, 60.2664251544495],
      [29.948576019403, 60.2476041405961]
    ]
    const first = input?.split(',')[0]?.trim()
    const second = input?.split(',')[1]?.trim()
    // Создаем объект многоугольника с использованием Turf.js
    const polygon = turf.polygon([polygonCoordinates])
    const userPoint = turf.point([second, first])
    // Проверка, лежит ли точка внутри многоугольника
    const isInside = turf.booleanPointInPolygon(userPoint, polygon)

    if (isInside) {
      console.log('Точка находится в зоне игры!')
    } else {
      console.log('Точка не в зоне игры!')
    }
  }

  async registration (msg) {
    try {
      if (/^\/start$/i.test(msg.text)) {
        const chatId = msg.from.id
        const text = `Привет. Это бот для игры "Застрянь друга" от команды Liteoffroad\nВ разделах меню ты найдешь всю необходимую информацию.\nПо техническим вопросам работы бота писать @skaman91\nУдачи 😉`
        await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
        const username = msg.from.username
        const firstName = msg.from.first_name
        const id = msg.from.id
        const profile = await userCollection.findOne({ id: id })
        if (!profile) {
          await userCollection.insertOne({
            id: id,
            firstName: firstName,
            username: username,
            rating: 0,
            eventRating: 0,
            position: 0,
            positionTime: new Date().getTime(),
            takePoints: 0,
            installPoints: 0,
            banned: false,
            event: {
              eventTakePoints: 0,
              eventInstallPoints: 0,
              eventRating: 0,
              eventPosition: 0,
              eventPositionTime: new Date().getTime()
            },
            resultEvents: {},
            takenPoints: [],
            noInstallPoints: [],
            winner: ''
          })
          await this.bot.sendMessage(chatId, 'Вы успешно зарегистрированы')
          await this.bot.sendMessage(chatId, '🏙 Выберите город:', {
            reply_markup: {
              inline_keyboard: CITIES.map(city => [{ text: city, callback_data: `city_${city}` }])
            }
          })
          return
        }
      }
    } catch (e) {
      console.log('Failed registration', e.message)
    }
  }

  async getUserCity (userId) {
    const user = await userCollection.findOne({ id: userId })
    return user ? user.city : 'Не указан'
  }

  async updateUserCity (userId, city) {
    console.log('updateUserCity', userId, city)
    await userCollection.updateOne({ id: userId }, {
      $set: {
        city: city,
      }
    })
  }

  async onCallback (msg) {
    try {
      const chatId = msg.from.id
      if (msg.data.startsWith('Точка_')) {
        const pointName = msg.data.replace(/_/g, ' ').trim()
        await this.takePoint(msg, pointName)
        await this.bot.deleteMessage(chatId, msg.message.message_id)
        return
      }
      switch (msg.data) {
        case 'tookPoints': { // забрал
          console.log('Забрал usersMap[chatId].textForChanel', usersMap[chatId].textForChanel)
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          await collection.updateOne({ point: usersMap[chatId].point }, {
            $set: {
              id: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
              install: usersMap[chatId].install,
              coordinates: usersMap[chatId].install ? usersMap[chatId].coordinates : ',',
              comment: usersMap[chatId].comment,
              photo: usersMap[chatId].photo,
              installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
              installedId: msg.from.id,
              rating: 1,
              takeTimestamp: new Date().getTime(),
              updateTimestamp: new Date().getTime()
            }
          })
          await this.delay(500)
          // await this.bot.sendMessage(chatId, 'Вы забрали точку, установите ее на новое место, не ближе 5км от места взятия в течение 3х дней, а лучше сразу))', { disable_notification: true })
          console.log('Точку забрали')
          usersMap[chatId].textForChatId += '\n❗Вы забрали точку, установите ее на новое место, не ближе 5км от места взятия в течение 3х дней, а лучше сразу))❗'
          usersMap[chatId].textForChanel += '\n❗Точку забрали❗'

          await this.bot.sendPhoto(chatId, usersMap[chatId].photo, {
            caption: usersMap[chatId].textForChatId,
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
          })
          await this.bot.sendPhoto(CHANEL_LITEOFFROAD, usersMap[chatId].photo, {
            caption: usersMap[chatId].textForChanel,
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
          })

          const now = Date.now() * 1000
          const newPoint = { point: usersMap[chatId].point, timestamp: now }

          // Обновляем запись пользователя в базе данных, добавляя точку в массив noInstallPoints
          await userCollection.updateOne(
            { id: msg.from.id },
            { $push: { noInstallPoints: newPoint } }
          )

          await this.defaultData(chatId)
          break
        }
        case 'noTookPoints': { // оставил
          console.log('Оставил usersMap[chatId].textForChanel', usersMap[chatId].textForChanel)

          const isPoint = await collection.findOne({ point: usersMap[chatId].point })
          const user = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
          const takers = isPoint.takers
          takers.push(user)
          await collection.updateOne({ point: usersMap[chatId].point }, {
            $inc: { rating: 1 },
            $set: { takers: takers }
          })
          usersMap[chatId].textForChatId += '\n❗Вы оставили точку на месте❗'
          usersMap[chatId].textForChanel += '\n❗❗❗Точку оставили на месте, рейтинг точки повышен на 1❗❗❗'

          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          await this.bot.sendPhoto(chatId, usersMap[chatId].photo, {
            caption: usersMap[chatId].textForChatId,
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
          })
          await this.bot.sendPhoto(CHANEL_LITEOFFROAD, usersMap[chatId].photo, {
            caption: usersMap[chatId].textForChanel,
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
          })

          // await this.bot.sendMessage(chatId, 'Вы оставили точку на месте', { disable_notification: true })
          console.log('Точку оставили на месте')
          // await this.bot.sendMessage(CHANEL_LITEOFFROAD, 'Точку оставили на месте, рейтинг точки повышен на 1', { disable_notification: true })
          await this.defaultData(chatId)
          break
        }
        case 'cancel': {
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id).catch(() => {})
          await this.bot.sendMessage(chatId, '👌 Хорошо, ничего не меняем.')
          break
        }
        case 'change_city': {
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id).catch(() => {})
          await this.bot.sendMessage(chatId, 'Выберите новый город:', {
            reply_markup: {
              inline_keyboard: CITIES.map(city => [{ text: city, callback_data: `city_${city}` }])
            }
          })
          break
        }
      }

      if (msg.data.startsWith('city_')) {
        const newCity = msg.data.replace('city_', '')

        await this.updateUserCity(msg.from.id, newCity)
        await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id).catch(() => {})
        await this.bot.sendMessage(chatId, `✅ Ваш город успешно обновлен на *${newCity}*!`, { parse_mode: 'Markdown' })
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async takePoint (msg, pointText) {
    const chatId = msg.from.id
    if (usersMap[chatId].step === 1 && !usersMap[chatId].point && usersMap[chatId].install) {
      const pointField = /точка [0-9]+/i.test(pointText)
      if (pointField && !usersMap[chatId].point) {
        usersMap[chatId].point = pointText
        const pointInBase = await collection.findOne({ point: pointText })
        if (!pointInBase) {
          await this.bot.sendMessage(chatId, 'Такой точки не существует, возможно вы опечатались')
          return
        }
        if (usersMap[chatId].install && pointInBase.install) {
          await this.bot.sendMessage(chatId, '❗Точка уже установлена, ее сперва нужно взять❗')
          return
        }
        await this.bot.sendMessage(chatId, 'Отлично, теперь отправь координаты. Они должны быть в таком формате (без ковычек, просто цифры с запятой посередине) "60.342349, 30.017123"')
        usersMap[chatId].step = 2
      }
    } else if (usersMap[chatId].step === 1 && !usersMap[chatId].install) {
      usersMap[chatId].point = pointText
      const pointInBase = await collection.findOne({ point: pointText })
      if (!pointInBase) {
        await this.bot.sendMessage(chatId, '❗Такой точки не существует, возможно вы опечатались❗')
        return
      }
      if (!usersMap[chatId].install && !pointInBase.install) {
        await this.bot.sendMessage(chatId, '❗Точка уже взята, ее сперва нужно установить❗')
        return
      }
      const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name

      if ((!usersMap[chatId].install && pointInBase.takers.includes(username)) || (!usersMap[chatId].install && pointInBase.installed === username)) {
        await this.bot.sendMessage(chatId, `❗❗❗Вы уже брали эту точку, нельзя брать точки повторно. Вы сможете снова взять эту точку, только если другой участник ее переставит.❗❗❗`)
        return
      }

      // нельзя иметь на руках больше 3 точек
      if (usersMap[chatId].noInstallPoints) {
        if (usersMap[chatId].noInstallPoints.length === 2) {
          await this.bot.sendMessage(chatId, `❗У вас уже есть 2 точки на руках, после взятия этой точки, вам нужно расставить имеющиеся точки❗`)
        }
        if (usersMap[chatId].noInstallPoints.length === 3) {
          await this.bot.sendMessage(chatId, `❗У вас 3 точки на руках, вы не можете брать точки, пока не расставите имеющиеся❗`)
        }
      }

      // каждую точку можно брать только раз в сутки
      const now = Date.now()
      await userCollection.updateOne(
        { id: msg.from.id },
        {
          $pull: { takenPoints: { timestamp: { $lt: now - 24 * 60 * 60 * 1000 } } }  // Удаляем записи старше 24 часов
        }
      )
      const user = await userCollection.findOne({ id: msg.from.id })
      const takenPoints = user ? user.takenPoints : []
      usersMap[chatId].takenPoints = takenPoints
      const pointEntry = takenPoints.find(p => p.point === pointText)
      if (pointEntry && (now - pointEntry.timestamp < 24 * 60 * 60 * 1000)) {
        const msLeft = 24 * 60 * 60 * 1000 - (now - pointEntry.timestamp)

        const hours = Math.floor(msLeft / (1000 * 60 * 60))
        const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60))

        const timeLeft = `${hours} ч ${minutes} мин`

        await this.bot.sendMessage(chatId, `❗Вы уже брали эту точку в течение 24 часов. Вы сможете взять её снова через ${timeLeft}.❗`)
        return
      }

      await this.bot.sendMessage(chatId, 'Напиши комментарий, например впечатления о взятии точки, было сложно или просто. Ну что-то такое) Либо просто отправь прочерк -')
      usersMap[chatId].step = 3
    }
  }

  async checkInstallPoints() {
    const now = Date.now()
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
    // const TWENTY_FOUR_HOURS_MS = 5 * 60 * 1000

    const users = await userCollection.find({
      noInstallPoints: { $exists: true, $not: { $size: 0 } }
    }).toArray()

    for (const user of users) {
      // Фильтруем просроченные точки
      const overduePoints = user.noInstallPoints.filter(p => {
        const ts = typeof p.timestamp === 'number' ? p.timestamp : Number(p.timestamp)
        return now - ts > THREE_DAYS_MS
      })

      if (overduePoints.length > 0) {
        // Проходим по каждой просроченной точке и проверяем, прошло ли 24 часа с последнего списания
        let pointsToDeduct = []
        for (const point of overduePoints) {
          const lastDeduction = point.lastDeductionTimestamp || 0
          if (now - lastDeduction >= TWENTY_FOUR_HOURS_MS) {
            pointsToDeduct.push(point)
          }
        }

        // Если есть точки, для которых прошло 24 часа, списываем баллы
        if (pointsToDeduct.length > 0) {
          const username = user.username
            ? `@${user.username}`
            : `<a href="tg://user?id=${user.id}">${user.firstName || 'Пользователь'}</a>`

          let text = `🔔 У пользователя ${username} просроченные точки:\n`
          for (const point of pointsToDeduct) {
            const diff = now - point.timestamp
            const days = Math.floor(diff / (1000 * 60 * 60 * 24))
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

            text += `<b>${point.point}</b> была взята <b>${days} дн ${hours} ч</b> назад.\n`
          }
          text += `За просрочку списано ${pointsToDeduct.length} б.\n`
          await this.bot.sendMessage(139280481, text, { parse_mode: 'HTML' })

          // Обновляем timestamp последнего списания для каждой точки
          await userCollection.updateOne(
            { _id: user._id },
            {
              $set: {
                "noInstallPoints.$[elem].lastDeductionTimestamp": now
              },
            },
            {
              arrayFilters: [
                { "elem": { $in: pointsToDeduct } }
              ]
            }
          )
          // await userCollection.updateOne({ id: user.id }, {
          //   $inc: {
          //     rating: -1
          //   }
          // })
          // if (eventStarting) {
          //   await userCollection.updateOne({ id: user.id }, {
          //     $inc: {
          //       'event.rating': -1
          //     }
          //   })
          // }
        }
      }
    }
  }



  async ratingCursor () {
    const result = []
    const eventResult = []
    const cursor = await userCollection.find({ rating: { $gt: 0 } })
      .sort({
        position: 1,
        rating: -1,
        installPoints: -1,
        takePoints: -1
      })
    const eventCursor = await userCollection.find({ 'event.rating': { $gt: 0 } })
      .sort({
        'event.eventPosition': 1,
        'event.rating': -1,
        'event.installPoints': -1,
        'event.takePoints': -1
      })
    for (let data = await eventCursor.next(); data !== null; data = await eventCursor.next()) {
      eventResult.push(data)
    }
    for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
      result.push(data)
    }
    return { result, eventResult }
  }

  async refreshRating () {
    try {
      if (eventStarting) {
        try {
          const res = await this.ratingCursor()
          const resultUsers = res.result

          if (!resultUsers.length) {
            return
          }

          const eventUsers = await userCollection.find({ 'event.rating': { $gt: 0 } }).sort({
            'event.rating': -1,
            'event.eventPosition': 1,
            'event.installPoints': -1,
            'event.takePoints': -1
          }).toArray()

          let message = ''
          let positionChanged = false
          let positionAlert = false

          for (let i = 0; i < eventUsers.length; i++) {
            const user = eventUsers[i]
            const newPosition = i + 1

            if (user.event.eventPosition !== newPosition) {
              positionChanged = true

              if (newPosition <= 10 || user.position <= 10) {
                positionChanged = true
                positionAlert = true

                const userMention = user.username
                  ? `@${user.username}`
                  : `<a href="tg://user?id=${user.id}">${user.firstName}</a>`

                message += `${userMention} теперь на ${newPosition} месте\n\n`
              }

              await userCollection.updateOne({ _id: user._id }, {
                $set: {
                  'event.eventPosition': newPosition,
                  'event.eventPositionTime': Date.now()
                }
              })
            }
          }

          if (positionChanged && positionAlert) {
            message += `<a href="https://t.me/liteoffroad_bot?start=eventresults">Посмотреть рейтинг этапа</a>`
            await this.bot.sendMessage(CHANEL_LITEOFFROAD, `🏆 Позиции в рейтинге этапа обновились\n\n${message}`, {
              parse_mode: 'HTML',
              disable_notification: true
            })
          }
        } catch (e) {
          console.error('Refresh event results', e.message)
        }
      }
      try {
        const res = await this.ratingCursor()
        const result = res.result
        if (!result.length) {
          return
        }
        const users = await userCollection.find({ rating: { $gt: 0 } }).sort({
          rating: -1,
          position: 1,
          installPoints: -1,
          takePoints: -1
        }).toArray()

        let message = ''
        let positionChanged = false
        let positionAlert = false

        for (let i = 0; i < users.length; i++) {
          const user = users[i]
          const newPosition = i + 1

          if (user.position !== newPosition) {
            positionChanged = true

            if (newPosition <= 10 || user.position <= 10) {
              positionChanged = true
              positionAlert = true

              const userMention = user.username
                ? `@${user.username}`
                : `<a href="tg://user?id=${user.id}">${user.firstName}</a>`

              message += `${userMention} теперь на ${newPosition} месте\n\n`
            }

            await userCollection.updateOne({ _id: user._id }, {
              $set: {
                position: newPosition,
                positionTime: Date.now()
              }
            })
          }
        }

        if (positionChanged && !eventStarting && positionAlert) {
          await this.bot.sendMessage(CHANEL_LITEOFFROAD, `🏆 Позиции в общем рейтинге игры обновились\n\n${message}`, {
            parse_mode: 'HTML',
            disable_notification: true
          })
        }
      } catch (e) {
        console.error('Refresh game results', e.message)
      }
    } catch (e) {
      console.error('Failed to refresh rating', e.message)
    }
  }

  async onFile (msg) {
    try {
      const chatId = msg.from.id
      usersMap[chatId].photo = msg.photo[0].file_id
      console.log(this.getTime())
      console.log('Отправлено фото: ', usersMap[chatId].photo)
      const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
      const pointField = await collection.findOne({ point: usersMap[chatId].point })
      if (usersMap[chatId].step === 4 && usersMap[chatId].photo) {
        const text = usersMap[chatId].install
          ? 'Отлично, этого достаточно. За установку этой точки, тебе начислено 2 балла'
          : `Отлично, этого достаточно. За взятие этой точки, тебе начислено: ${pointField.rating} ${this.declOfNum(pointField.rating, 'балл')}`
        await this.bot.sendMessage(chatId, text)
        usersMap[chatId].rating = pointField.rating
      } else {
        return
      }
      const profile = await userCollection.findOne({ id: msg.from.id })
      const textForChatId = usersMap[chatId].install
        ? `${usersMap[chatId].point} Установлена!🔥\nКоординаты: <code>${usersMap[chatId].coordinates}</code>\nУстановил: ${username}\n${usersMap[chatId].comment}\nТебе добавлен рейтинг +2\nОбщий рейтинг ${profile.rating + 2}\nСообщение продублировано в основной канал @liteoffroad`
        : `${usersMap[chatId].point} Взята 🔥\n\n${usersMap[chatId].comment}\n\nТочку взял: ${username}\nТебе добавлен рейтинг +${usersMap[chatId].rating}\nОбщий рейтинг ${profile.rating + usersMap[chatId].rating}\nСообщение продублировано в основной канал @liteoffroad`

      const textForChanel = usersMap[chatId].install
        ? `${usersMap[chatId].point} Установлена!🔥\nКоординаты: <code>${usersMap[chatId].coordinates}</code>\nУстановил: ${username}\n${usersMap[chatId].comment}\nЕму добавлен рейтинг +2\n<a href="https://point-map.ru/?id=${pointField.id}&type=install">📍Карта с точками📍</a>`
        : `${usersMap[chatId].point} Взята 🔥\n\n${usersMap[chatId].comment}\n\nТочку взял: ${username}\nКооринаты: <code>${pointField.coordinates}</code>\nЕму добавлен рейтинг +${usersMap[chatId].rating}\n<a href="https://point-map.ru/?id=${pointField.id}&type=take">📍Карта с точками📍</a>`

      usersMap[chatId].textForChatId = textForChatId
      usersMap[chatId].textForChanel = textForChanel

      if (usersMap[chatId].install) {
        await this.bot.sendPhoto(chatId, usersMap[chatId].photo, {
          caption: textForChatId,
          parse_mode: 'HTML',
          disable_notification: true,
          disable_web_page_preview: true
        })
        await this.bot.sendPhoto(CHANEL_LITEOFFROAD, usersMap[chatId].photo, {
          caption: textForChanel,
          parse_mode: 'HTML',
          disable_notification: true,
          disable_web_page_preview: true
        })
      }

      if (pointField) {
        if (usersMap[chatId].install) {
          await historyCollection.insertOne({
            id: pointField.id || Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
            point: pointField.point,
            comment: pointField.comment,
            coordinates: pointField.coordinates,
            install: true,
            installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
            installedId: msg.from.id,
            photo: pointField.photo,
            rating: pointField.rating,
            takers: pointField.takers,
            city: pointField.city,
            takeTimestamp: new Date().getTime(),
            updateTimestamp: new Date().getTime()
          })
        } else {
          await historyCollection.insertOne({
            id: pointField.id || Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
            point: pointField.point,
            comment: usersMap[chatId].comment,
            coordinates: pointField.coordinates,
            install: false,
            installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
            installedId: msg.from.id,
            photo: pointField.photo,
            rating: pointField.rating,
            takers: pointField.takers,
            city: pointField.city,
            takeTimestamp: new Date().getTime(),
            updateTimestamp: new Date().getTime()
          })
        }

        if (msg.from.id) {
          await userCollection.updateOne({ id: msg.from.id }, {
            $inc: {
              rating: usersMap[chatId].install ? 2 : usersMap[chatId].rating,
              installPoints: usersMap[chatId].install ? 1 : 0,
              takePoints: !usersMap[chatId].install ? 1 : 0
            }
          })
          if (eventStarting) {
            await userCollection.updateOne({ id: msg.from.id }, {
              $inc: {
                'event.rating': usersMap[chatId].install ? 2 : usersMap[chatId].rating,
                'event.eventInstallPoints': usersMap[chatId].install ? 1 : 0,
                'event.eventTakePoints': !usersMap[chatId].install ? 1 : 0
              }
            })
          }

          if (eventStarting) {
            await this.refreshRating()
          } else {
            await this.refreshRating()
          }
        }

        if (usersMap[chatId].install) {
          await collection.updateOne({ point: usersMap[chatId].point }, {
            $set: {
              id: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
              install: usersMap[chatId].install,
              installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
              installedId: msg.from.id,
              coordinates: usersMap[chatId].install ? usersMap[chatId].coordinates : ',',
              comment: usersMap[chatId].comment,
              photo: usersMap[chatId].photo,
              rating: 1,
              takers: [],
              takeTimestamp: new Date().getTime(),
              updateTimestamp: new Date().getTime()
            }
          })
          await userCollection.updateOne(
            { id: msg.from.id },
            { $pull: { noInstallPoints: { point: usersMap[chatId].point } } }  // Удаляем точку из массива noInstallPoints
          )
        }
        if (!usersMap[chatId].install) {
          await this.bot.sendMessage(chatId, `Точка осталась на месте или забрал?`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Оставил', callback_data: 'noTookPoints' }, { text: 'Забрал', callback_data: 'tookPoints' }]
              ]
            }
          })
          const now = Date.now() * 1000
          await userCollection.updateOne(
            { id: msg.from.id },
            { $push: { takenPoints: { point: usersMap[chatId].point, timestamp: now } } }
          )
        } else {
          await this.defaultData(chatId)
        }
      } else {
        await this.bot.sendMessage(chatId, 'Такая точка не найдена')
        await this.defaultData(chatId)
      }
    } catch (e) {
      console.log('Failed onFile', e.message)
    }
  }

  delay (minDelay, maxDelay) {
    const timeout = maxDelay ? ~~((minDelay + (maxDelay - minDelay) * Math.random())) : minDelay

    return new Promise(resolve => setTimeout(resolve, timeout))
  }

  // Получение текущей даты и времени
  getTime () {
    const currentTime = new Date()
    currentTime.setHours(currentTime.getHours() + 3)

    const day = String(currentTime.getDate()).padStart(2, '0')
    const month = String(currentTime.getMonth() + 1).padStart(2, '0')
    const year = currentTime.getFullYear()
    const hours = String(currentTime.getHours()).padStart(2, '0')
    const minutes = String(currentTime.getMinutes()).padStart(2, '0')
    const seconds = String(currentTime.getSeconds()).padStart(2, '0')

    return `${day}.${month}.${year} - ${hours}:${minutes}:${seconds}`
  }

  // Обновляем точки, которые не переставили в течение недели
  async updatePointsRating () {
    try {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const oneWeekAgoTimestamp = oneWeekAgo.getTime()

      const filter = {
        updateTimestamp: { $lte: oneWeekAgoTimestamp },
        install: true,
        rating: { $lte: 10 },
        comment: { $ne: 'точку украли' },
        point: { $ne: 'Точка 88' }
      }

      const pointsLastWeekAgo = await collection.find(filter).toArray()

      if (pointsLastWeekAgo.length === 0) {
        return
      }

      await collection.updateMany(
        filter,
        {
          $inc: { rating: 1 },
          $set: { updateTimestamp: new Date().getTime() },
        }
      )

      let message = '📣Автоматически обновлен рейтинг для следующих точек:📣\n\n'

      for (const point of pointsLastWeekAgo) {
        message += `${point.point}: Новый рейтинг: ${point.rating + 1}\n`
        const user = await userCollection.findOne({ id: point.installedId })
        if (user) {
          if (!user.banned) {
            await userCollection.updateOne({ id: point.installedId },
              {
                $inc: { rating: 1 }
              }
            )
            message += `Точку устанавливал ${point.installed}, ему добавлен 1 балл\n\n`
          }
          if (eventStarting) {
            await userCollection.updateOne({ id: point.installedId },
              {
                $inc: { 'event.rating': 1 }
              }
            )
          }
        }
      }
      await this.bot.sendMessage(CHANEL_LITEOFFROAD, message)
      await this.refreshRating()
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Ошибка при обновлении рейтингов:`, e.message)
    }
  }

  async setEventStarting (value) {
    eventStarting = value
    await stateCollection.updateOne(
      { key: 'eventStarting' },
      { $set: { value } },
      { upsert: true }
    )
  }

  // кол-во дней с даты (timestamp)
  getDaysSinceInstallation (timestamp) {
    const currentDate = new Date()
    const installationDate = new Date(timestamp)

    // Разница в днях, считая смену даты
    return Math.ceil((currentDate - installationDate) / (1000 * 60 * 60 * 24))
  }

  declOfNum (number, label) {
    const labels = {
      'балл': ['балл', 'балла', 'баллов'],
      'час': ['час', 'часа', 'часов'],
      'мин': ['минуту', 'минуты', 'минут'],
      'дней': ['день', 'дня', 'дней']
    }

    const map = labels[label]

    if (!map) {
      return label
    }

    const cases = [2, 0, 1, 1, 1, 2]

    return map[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]]
  }

  async defaultData (chatId) {
    const profile = await userCollection.findOne({ id: chatId })

    usersMap[chatId] = {
      username: usersMap[chatId].username || '',
      firstName: usersMap[chatId].firstName || '',
      userId: usersMap[chatId].userId || '',
      step: 0,
      point: '',
      coordinates: '',
      comment: '',
      rating: 0,
      install: false,
      photo: '',
      waitingForResponse: false,
      city: profile.city || '',
      textForChanel: '',
      textForChatId: '',
      takenPoints: profile.takenPoints || [],
      noInstallPoints: profile.noInstallPoints || []
    }
  }

  stop () {
    if (this.bot) {
      this.bot.stop()
    }
  }
}