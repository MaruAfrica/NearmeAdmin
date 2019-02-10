const express = require('express')
const admin = require('../middlewares/admin')

const router = express.Router()

router.get('/', admin, (req, res) => {
  res.redirect(req.baseUrl + '/places')
})

router.get('/places', admin, (req, res) => {
  res.render('places')
})

router.get('/categories', admin, (req, res) => {
  res.render('categories')
})

router.get('/users', admin, (req, res) => {
  res.render('users')
})

router.get('/reviews', admin, (req, res) => {
  res.render('reviews')
})

router.get('/slider-images', admin, (req, res) => {
  res.render('slider-images')
})

router.get('/notifications', admin, (req, res) => {
  res.render('notifications')
})

router.get('/posts', admin, (req, res) => {
  res.render('posts')
})

module.exports = router