Parse.Cloud.beforeSave('Review', async (req) => {

    const obj = req.object
    const attrs = obj.attributes
    const user = req.user

    if (!user && !req.master) throw 'Not Authorized'

    if (!obj.existed()) {
        const acl = new Parse.ACL()
        acl.setPublicReadAccess(true)
        acl.setRoleWriteAccess('Admin', true)
        acl.setWriteAccess(user, true)
        obj.setACL(acl)
        obj.set('user', user)
        obj.set('isInappropriate', false)
    }

    const query = new Parse.Query('Review')
    query.equalTo('user', user)
    query.equalTo('place', attrs.place)

    const exists = await query.first()

    if (exists) {
        throw new Parse.Error(5000, 'You already write a review for this place')
    } else if (obj.get('rating') < 1) {
        throw new Parse.Error(5001, 'You cannot give less than one star')
    } else if (obj.get('rating') > 5) {
        throw new Parse.Error(5002, 'You cannot give more than five stars')
    }

})

Parse.Cloud.afterSave('Review', async (req) => {

    const attrs = req.object.attributes

    try {

        let query = new Parse.Query('Place')
        let place = await query.get(attrs.place.id)

        if (place) {
            place.increment('ratingCount')
            place.increment('ratingTotal', attrs.rating)
            place.save(null, {
                useMasterKey: true
            })
        }

    } catch (err) {
        console.warn(err.message)
    }

})