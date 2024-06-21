import mongoose, { Mongoose } from 'mongoose'

const Schema = mongoose.Schema

const PointSchema = new Schema({
  username: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  }
})

mongoose.model('Points', PointSchema)