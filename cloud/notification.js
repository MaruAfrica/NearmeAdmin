Parse.Cloud.beforeSave('Notification', async (req) => {

    const obj = req.object
    const user = req.user

    if (!user && !req.master) throw 'Not Authorized'

    const query = new Parse.Query(Parse.Role)
    query.equalTo('name', 'Admin')
    query.equalTo('users', user)

    const adminRole = await query.first()

    if (!adminRole) throw 'Not Authorized'

    if (!obj.existed()) {
        const acl = new Parse.ACL()
        acl.setPublicReadAccess(true)
        acl.setRoleWriteAccess('Admin', true)
        obj.setACL(acl)
    }

})

Parse.Cloud.afterSave('Notification', (req) => {

    const obj = req.object
    const attrs = obj.attributes

    if (!obj.existed()) {

        const query = new Parse.Query(Parse.Installation)
        query.containedIn('deviceType', ['ios', 'android'])

        const params = {
            where: query,
            data: {
                alert: attrs.message,
                sound: 'default'
            }
        }

        Parse.Push.send(params, {
            useMasterKey: true
        })
    }

})