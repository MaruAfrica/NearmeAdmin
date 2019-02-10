const sharp = require('sharp')
const slug = require('limax')

Parse.Cloud.beforeSave('Post', async (req) => {

    const obj = req.object
    const attrs = obj.attributes
    const user = req.user

    if (!user && !req.master) throw 'Not Authorized'

    if (!req.master) {
        const query = new Parse.Query(Parse.Role)
        query.equalTo('name', 'Admin')
        query.equalTo('users', user)
    
        const adminRole = await query.first()
    
        if (!adminRole) throw 'Not Authorized'
    }

    if (!obj.existed()) {
        const acl = new Parse.ACL()
        acl.setPublicReadAccess(true)
        acl.setRoleWriteAccess('Admin', true)
        obj.setACL(acl)
    }

    if (obj.dirty('title')) {
        obj.set('canonical', attrs.title.toLowerCase())
    }

    obj.set('slug', slug(attrs.title))

    if (!attrs.image) return

    const httpResponse = await Parse.Cloud.httpRequest({
        url: attrs.image.url()
    })

    const imageResizedData = await sharp(httpResponse.buffer).resize(600).toBuffer()
    const imageThumbData = await sharp(httpResponse.buffer).resize(200, 200).toBuffer()

    const file = new Parse.File('image.jpg', {
        base64: imageResizedData.toString('base64')
    })

    const thumb = new Parse.File('image.jpg', {
        base64: imageThumbData.toString('base64')
    })

    await file.save()
    await thumb.save()

    obj.set('image', file)
    obj.set('imageThumb', thumb)
})

Parse.Cloud.afterSave('Post', (req) => {

    const obj = req.object
    const attrs = obj.attributes

    if (!obj.existed()) {

        const query = new Parse.Query(Parse.Installation)
        query.containedIn('deviceType', ['ios', 'android'])

        const params = {
            where: query,
            data: {
                alert: attrs.title,
                sound: 'default'
            }
        }

        Parse.Push.send(params, {
            useMasterKey: true
        })
    }

})