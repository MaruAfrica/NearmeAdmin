const cron = require('node-cron')
const moment = require('moment')

cron.schedule('* * * * *', async () => {

    try {

        const query = new Parse.Query('Place')
        query.notEqualTo('status', 'Expired')
        query.exists('expiresAt')
        query.lessThanOrEqualTo('expiresAt', moment.utc().toDate())

        const places = await query.find()

        places.forEach(place => place.set('status', 'Expired'))

        await Parse.Object.saveAll(places, {
            useMasterKey: true
        })

    } catch (err) {
        console.log(err.message)
    }

})