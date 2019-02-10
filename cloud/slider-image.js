Parse.Cloud.beforeSave('SliderImage', async (req) => {

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
        obj.set('isActive', true)
    }
})