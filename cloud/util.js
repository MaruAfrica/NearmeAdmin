Parse.Cloud.define('getHomePageData', async () => {

    const query1 = new Parse.Query('Category')
    query1.ascending('sort')
    query1.limit(10);
    query1.doesNotExist('deletedAt')

    const query2 = new Parse.Query('Place')
    query2.equalTo('status', 'Approved')
    query2.equalTo('isFeatured', true)
    query2.doesNotExist('deletedAt')
    query2.include('category')
    query2.limit(10)
    query2.descending('createdAt')

    const query3 = new Parse.Query('Place')
    query3.equalTo('status', 'Approved')
    query3.doesNotExist('deletedAt')
    query3.include('category')
    query3.limit(10)
    query3.descending('createdAt')

    const pipeline4 = {
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

    const query4 = new Parse.Query('Place')

    const query5 = new Parse.Query('SliderImage')
    query5.equalTo('isActive', true)
    query5.ascending('sort')
    query5.include('place')

    const results = await Promise.all([
        query1.find(),
        query2.find(),
        query3.find(),
        query4.aggregate(pipeline4),
        query5.find()
    ])

    const ids = results[3].map(place => place.objectId)

    const query = new Parse.Query('Place')
    query.containedIn('objectId', ids)
    query.include('category')
    const randomPlaces = await query.find()

    return {
        categories: results[0],
        featuredPlaces: results[1],
        newPlaces: results[2],
        randomPlaces: randomPlaces,
        slides: results[4]
    }

})