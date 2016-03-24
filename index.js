var fs = require('fs-extra');
var path = require('path');
var glob = require('glob');
var crypto = require('crypto-js');

var nb = {
    directories: 0,
    files: 0
};

function getLog (opts, log) {
    var fn = function () {
        if (!opts || !opts.silent) {
            console.log.apply(null, arguments);
        }
    };

    return log || {
        debug: fn,
        error: function (error) {
            if (!opts || !opts.silent) {
                console.error(error);
            }
            throw error instanceof Error ? error : new Error(error);
        },
        fatal: function (error) {
            if (!opts || !opts.silent) {
                console.error(error);
            }
            process.exit(1);
        },
        info: fn,
        ok: fn
    };
}

var log = getLog();

function decode (data, passphrase) {
    try {
        var decoded;
        if (passphrase && passphrase !== '') {
            decoded = crypto.AES.decrypt(data.toString(), passphrase)
                .toString(crypto.enc.Utf8);
        }
        decoded = decodeURIComponent(decoded || data);
        return decoded;
    } catch (e) {
        log.error(e);
    }
}

function encode (data, passphrase) {
    try {
        var encoded = encodeURIComponent(data);
        if (passphrase && passphrase !== '') {
            encoded = crypto.AES.encrypt(encoded, passphrase);
        }
        return encoded;
    } catch (e) {
        log.error(e);
    }
}

function get (pattern, opts) {
    try {
        return glob.sync(pattern, opts);
    } catch (e) {
        log.error(e);
    }
}

function read (fileName, cwd) {
    fileName = cwd ? path.join(cwd, fileName) : fileName;
    try {
        return fs.readFileSync(fileName).toString();
    } catch (e) {
        log.error(e);
    }
}

function remove (fileName, cwd) {
    try {
        fs.removeSync(path.join(cwd, fileName));
    } catch (e) {
        log.error(e);
    }
}

function safe (fileName, cwd, files) {
    // Remove previously saved files.
    remove(fileName, cwd);
    // And create a new one.
    try {
        fs.mkdirSync(path.join(cwd, fileName));
    } catch (e) {
        return log.error(e);
    }
    // Loop through and move
    files.forEach(function (file) {
        try {
            fs.copySync(path.join(cwd, file), path.join(cwd, fileName, file));
        } catch (e) {
            log.error(e);
        }
    });
}

function write (fileName, cwd, data) {
    try {
        fs.writeJson(path.join(cwd, fileName), data);
    } catch (e) {
        log.error(e);
    }
}

function putBack(fileName, cwd, type, data) {
    if (type === 'directory') {
        nb.directories += 1;
        try {
            // We create the directory back.
            fs.mkdirSync(path.join(cwd, fileName));
        } catch (e) {
            log.error(e);
        }
    } else if (type === 'file') {
        nb.files += 1;
        try {
            // We create the file back.
            fs.outputFileSync(path.join(cwd, fileName), decode(data));
        } catch (e) {
            log.error(e);
        }
    }
}

function walk (ar, action) {
    if (ar instanceof Array) {
        ar.forEach(function (item, index) {
            action(item, index);
        });
    } else {
        for (var i in ar) {
            if (ar.hasOwnProperty(i)) {
                action(ar[i], i);
            }
        }
    }
}

function loopConstrict (files, ignore, store, passphrase) {
    var opts, absolutePath;
    store = store || {};
    walk(files, function (file) {
        // Only save files, not directories.
        if (!fs.statSync(file).isDirectory()) {
            nb.files += 1;
            store[file] = {
                content: encode(read(file), passphrase)
            };
        } else {
            nb.directories += 1;
        }
    });
    return store;
}

function merge (destination, store) {
    var previousStore = {};
    try {
        previousStore = fs.readJsonSync(destination);
    } catch (e) {
        // No previous file.
        return store;
    }
    return Object.assign(previousStore, store);
}

function constrict (opts) {
    // Control options
    if (!opts || (!opts.pattern && !opts.files)) {
        log.error(
            'Missing options "pattern" and / or "files"'
        );
        return;
    }

    if (opts.files && !opts.files instanceof Array) {
        log.error(
            'Wrong type option "files", must be an array'
        );
        return;
    }

    // Get the files to constrict together.
    var files = opts.files || [];
    if (opts.pattern) {
        var opts = {
            ignore: opts.ignore,
            dot: true
        };
        files = files.concat(get(opts.pattern, opts));
    }

    // If we don't have any files... we can't do anything
    if (files.length <= 0) {
        log.fatal(
            'No file selected, nothing to constrict.'
        );
    }

    // Return the json constricted.
    var output = loopConstrict(
        files,
        opts.ignore,
        opts.passphrase
    );

    // If we have a destination we write
    // the output in the file.
    if (opts.destination) {
        write(opts.destination, opts.cwd, output);
    }

    return output;
}

function liberate (fileName) {
    var files = fs.readJsonSync(fileName);
}

module.exports = {
    decode: decode,
    encode: encode,
    get: get,
    getLog: getLog,
    nb: nb,
    putBack: putBack,
    read: read,
    remove: remove,
    safe: safe,
    write: write,
    constrict: constrict,
    liberate: liberate
};
