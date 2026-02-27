(function() {
    const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    
    Object.defineProperty(document, 'cookie', {
        get: function() {
            return originalCookie.get.call(this);
        },
        set: function(val) {
            console.log(`[Cookie Hook] Setting cookie: ${val}`);
            console.trace('Cookie set stack trace');
            return originalCookie.set.call(this, val);
        }
    });
})();