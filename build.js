const fs = require('fs-extra-promise');
const path = require('path');
const rmrf = require('rmrf-promise');
const { omit } = require('lodash');

(async function() {

    const buildPath = 'build';
    await rmrf(buildPath);
    await fs.ensureDirAsync(buildPath);

    const publicFiles = await fs.readdirAsync('public');
    for(const file of publicFiles) {
        await fs.copyAsync(path.join('public', file), path.join(buildPath, file));
    }

    await fs.copyAsync('.env', path.join(buildPath, '.env'));

    const packageJSON = await fs.readJsonAsync('package.json');
    const newPackageJSON = omit(packageJSON, [
        'build',
        'devDependencies'
    ]);
    await fs.writeJsonAsync(path.join(buildPath, 'package.json'), newPackageJSON);

})();
