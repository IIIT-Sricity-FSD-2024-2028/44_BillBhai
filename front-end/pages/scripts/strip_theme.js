const fs = require('fs');
const path = require('path');
const dir = __dirname;
const files = ['inventory.html', 'delivery.html', 'returns.html', 'reports.html', 'users.html', 'profile.html', 'settings.html', 'notifications.html'];
files.forEach(function (f) {
    var fp = path.join(dir, f);
    var c = fs.readFileSync(fp, 'utf8');
    var lines = c.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('id="themeToggle"') !== -1) {
            console.log('Removed from ' + f + ' line ' + (i + 1));
            continue;
        }
        out.push(lines[i]);
    }
    fs.writeFileSync(fp, out.join('\n'), 'utf8');
});
console.log('All done');
