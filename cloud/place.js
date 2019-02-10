const sharp = require('sharp')
const slug = require('limax')
const Place = require('../models/place')

Parse.Cloud.define('getRandomPlaces', async () => {

    const pipeline = {
        match: {
            status: 'Approved',
            deletedAt: {
                '$exists': false
            }
        },
        sample: {
            size: 50
        }
    }

    const query = new Parse.Query('Place')

    const results = await query.aggregate(pipeline)

    const ids = results.map(result => result.objectId)

    const query1 = new Parse.Query('Place')
    query1.containedIn('objectId', ids)
    query1.include('category')

    return await query1.find()

})

Parse.Cloud.define('isPlaceStarred', async (req) => {

    const user = req.user
    const placeId = req.params.placeId

    if (!user) throw 'Not Authorized'

    const objPlace = new Parse.Object('Place')
    objPlace.id = placeId

    const query = new Parse.Query('Review')
    query.equalTo('place', objPlace)
    query.equalTo('user', user)

    const review = await query.first()
    const isStarred = review ? true : false
    return isStarred
})

Parse.Cloud.define('isPlaceLiked', async (req) => {

    const user = req.user
    const placeId = req.params.placeId

    if (!user) throw 'Not Authorized'

    const query = new Parse.Query('Place')
    query.equalTo('likes', user)
    query.equalTo('objectId', placeId)

    const place = await query.first()
    const isLiked = place ? true : false
    return isLiked

})

Parse.Cloud.define('likePlace', async (req) => {

    const user = req.user
    const placeId = req.params.placeId

    if (!user) throw 'Not Authorized'

    const query = new Parse.Query('Place')
    const place = await query.get(placeId)

    if (!place) throw ('Record not found')

    const query1 = new Parse.Query('Place')
    query1.equalTo('likes', user)
    query1.equalTo('objectId', placeId)
    const isLiked = await query1.first()

    const relation = place.relation('likes')

    let response

    if (isLiked) {
        place.increment('likeCount', -1)
        relation.remove(user)
        response = false
    } else {
        place.increment('likeCount', 1)
        relation.add(user)
        response = true
    }

    await place.save(null, {
        useMasterKey: true
    })

    return response

})

Parse.Cloud.beforeSave('Place', async (req) => {

    const obj = req.object
    const attrs = obj.attributes
    const user = req.user

    if (!user && !req.master) throw 'Not Authorized'

    await attrs.category.fetch();

    const canonical = attrs.title.toLowerCase() + ' ' +
        attrs.category.get('title').toLowerCase();

    obj.set('canonical', canonical)
    obj.set('slug', slug(attrs.title))

    if (!obj.existed()) {
        const acl = new Parse.ACL()
        acl.setPublicReadAccess(true)
        acl.setRoleWriteAccess('Admin', true)
        obj.setACL(acl)
        obj.set('status', attrs.status || 'Pending')
        obj.set('user', user)
    }

    const promises = []

    if (obj.get('image') && obj.dirty('image')) {

        const url = obj.get('image').url()

        const promise = Parse.Cloud.httpRequest({
                url: url
            })
            .then(httpResponse => {
                return sharp(httpResponse.buffer).resize(640).toBuffer()
            }).then(imageData => {
                return new Parse.File('image.jpg', {
                    base64: imageData.toString('base64')
                }).save()
            }).then(savedFile => {
                obj.set('image', savedFile)
            })

        promises.push(promise)

        const promiseThumb = Parse.Cloud.httpRequest({
                url: url
            })
            .then(httpResponse => {
                return sharp(httpResponse.buffer).resize(320, 320).toBuffer()
            }).then(imageData => {
                return new Parse.File('image.jpg', {
                    base64: imageData.toString('base64')
                }).save()
            }).then(savedFile => {
                obj.set('imageThumb', savedFile)
            })

        promises.push(promiseThumb)
    }

    if (obj.get('imageTwo') && obj.dirty('imageTwo')) {
        const url = obj.get('imageTwo').url()

        const promise = Parse.Cloud.httpRequest({
                url: url
            })
            .then(httpResponse => {
                return sharp(httpResponse.buffer).resize(640).toBuffer()
            }).then(imageData => {
                return new Parse.File('image.jpg', {
                    base64: imageData.toString('base64')
                }).save()
            }).then(savedFile => {
                obj.set('imageTwo', savedFile)
            })
        promises.push(promise)
    }

    if (obj.get('imageThree') && obj.dirty('imageThree')) {
        const url = obj.get('imageThree').url()

        const promise = Parse.Cloud.httpRequest({
                url: url
            })
            .then(httpResponse => {
                return sharp(httpResponse.buffer).resize(640).toBuffer()
            }).then(imageData => {
                return new Parse.File('image.jpg', {
                    base64: imageData.toString('base64')
                }).save()
            }).then(savedFile => {
                obj.set('imageThree', savedFile)
            })
        promises.push(promise)
    }

    if (obj.get('imageFour') && obj.dirty('imageFour')) {
        const url = obj.get('imageFour').url()

        const promise = Parse.Cloud.httpRequest({
                url: url
            })
            .then(httpResponse => {
                return sharp(httpResponse.buffer).resize(640).toBuffer()
            }).then(imageData => {
                return new Parse.File('image.jpg', {
                    base64: imageData.toString('base64')
                }).save()
            }).then(savedFile => {
                obj.set('imageFour', savedFile)
            })
        promises.push(promise)
    }

    await Promise.all(promises)

    // Resize gallery images

    if (obj.dirty('images')) {
        
        const resizedImages = []

        for (let image of attrs.images) {
    
          const httpResponse = await Parse.Cloud.httpRequest({
            url: image.url()
          })
          
          const imageData = await sharp(httpResponse.buffer).resize(600).toBuffer()
      
          const file = new Parse.File('photo.jpg', {
            base64: imageData.toString('base64')
          })
      
          await file.save()
    
          resizedImages.push(file)
        }
    
        obj.set('images', resizedImages)
    }
})

Parse.Cloud.afterSave('Place', async (req) => {

    const user = req.user
    const obj = req.object
    const attrs = obj.attributes

    try {

        if (!obj.existed()) {

            attrs.category.increment('placeCount')
            await attrs.category.save(null, {
                sessionToken: user.getSessionToken()
            })
    
        } else {
    
            const origObj = req.original
            const origAttrs = origObj.attributes
    
            if (attrs.category.id !== origAttrs.category.id) {
                
                attrs.category.increment('placeCount', 1)
                origAttrs.category.increment('placeCount', -1)
    
                await Promise.all([
                    attrs.category.save(null, { 
                        sessionToken: user.getSessionToken()
                    }),
                    origAttrs.category.save(null, {
                        sessionToken: user.getSessionToken()
                    })
                ])
            }
        }
        
    } catch (error) {
        console.warn(error.message)
    }

})

Parse.Cloud.afterDelete('Place', async (req) => {

    const obj = req.object
    const attrs = obj.attributes

    try {

        const category = attrs.category
        category.increment('placeCount', -1)
        await category.save(null, {
            useMasterKey: true
        })

    } catch (err) {
        console.warn(err.message)
    }

    try {

        const query = new Parse.Query('Review')
        query.equalTo('place', obj)
        const count = await query.count()
        query.limit(count)
        const results = await query.find()
        await Parse.Object.destroyAll(results, {
            useMasterKey: true
        })

    } catch (err) {
        console.warn(err.message)
    }

})