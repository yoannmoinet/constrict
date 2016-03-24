describe('dotconf', function () {
    'use strict';

    var chai = require('chai');
    var expect = chai.expect;
    var fs = require('fs-extra');
    var lib = require('../index');
    var path = require('path');
    var testFile = '.test';
    var testDirectory = 'testFolder';
    var testCWD = path.join(__dirname, testDirectory);
    var testPath = path.join(testCWD, testFile);
    var testContent = 'content';
    chai.use(require('chai-fs'));

    function createTestFiles () {
        fs.outputFileSync(path.join(testCWD, testFile), testContent);
    }

    function removeTestFiles () {
        fs.removeSync(testCWD);
    }

    function removeSafe () {
        fs.removeSync(path.join(__dirname, 'safe'));
    }

    function removeAll () {
        removeTestFiles();
        removeSafe();
    }

    after(removeAll);

    describe('getLog', function () {
        var log;
        before(function () {
            log = lib.getLog({silent: true});
        });

        it('should return 5 type of log', function () {
            expect(log.debug).to.be.a('function');
            expect(log.error).to.be.a('function');
            expect(log.fatal).to.be.a('function');
            expect(log.info).to.be.a('function');
            expect(log.ok).to.be.a('function');
        });

        it('should throw when log.error is called', function () {
            expect(log.error).to.throw(Error);
        });
    });

    describe('encode / decode', function () {
        var encoded, encrypted;
        var passphrase = 'I am a passphrase';
        var badPassPhrase = 'I am a bad passphrase';
        var expectEncoded = 'I%20am%20waiting%20to%20be%20encoded';
        var toEncode = 'I am waiting to be encoded';

        it('should encode', function () {
            encoded = lib.encode(toEncode);
            expect(encoded).to.be.equal(expectEncoded);
        });

        it('should encode and encrypt', function () {
            encrypted = lib.encode(toEncode, passphrase);
            expect(encrypted).to.not.be.equal(expectEncoded);
        });

        it('should decode', function () {
            expect(lib.decode(encoded)).to.be.equal(toEncode);
        });

        it('should decrypt or protect', function () {
            expect(lib.decode(encrypted, passphrase)).to.be.equal(toEncode);
            expect(lib.decode(encrypted)).to.not.be.equal(toEncode);
            expect(lib.decode(encrypted, badPassPhrase)).to.not.be.equal(toEncode);
        });
    });

    describe('write', function () {
        before(createTestFiles);

        it('should create a file', function () {
            expect(testPath).to.be.a.file().and.to.have.content(testContent);
        });
    });

    describe('get', function () {
        it('should return the array of file present in the folder', function () {
            expect(lib.get('*', {cwd: testCWD, dot: true})).to.be.eql(['.test']);
        });
    });

    describe('read', function () {
        it('should return the content of the file', function () {
            expect(lib.read(testFile, testCWD)).to.be.equal(testContent);
        });
    });

    describe('safe', function () {
        before(function () {
            lib.safe('safe', __dirname, [path.join(testDirectory, testFile)]);
        });

        it('should create a safe place for the files', function () {
            expect(path.join(__dirname, 'safe'))
                .to.be.a.directory()
                .and.not.empty;
            expect(path.join(__dirname, 'safe', testDirectory))
                .to.be.a.directory()
                .and.not.empty;
            expect(path.join(__dirname, 'safe', testDirectory, testFile))
                .to.be.a.file()
                .and.to.have.content(testContent);
        });
    });

    describe('remove', function () {

        it('should remove the specified file', function () {
            lib.remove(testFile, testCWD);
            expect(testPath).to.not.be.a.path();
            expect(testCWD).to.be.a.directory().and.empty;
            lib.remove(testDirectory, __dirname);
            expect(testCWD).to.not.be.a.path();
        });
    });

    describe('putBack', function () {
        before(function () {
            var encodedData = lib.encode(testContent);
            lib.putBack(testDirectory, __dirname, 'directory');
            lib.putBack(testFile, testCWD, 'file', encodedData);
        });

        it('should put directory back to its place', function () {
            expect(testCWD)
                .to.be.a.directory()
                .and.not.empty;
        });

        it('should put file back to its place with its decoded data', function () {
            expect(path.join(testCWD, testFile))
                .to.be.a.file()
                .and.to.have.content(testContent);
        });
    });

    xdescribe('walk', function () {
        var nbIterations;
        var result = 0;

        before(function () {
            lib.walk([0, 1, 2, 3, 4], function(item, index) {
                nbIterations += 1;
                result += item;
            });
        });

        it('should have called the callback the same number as the list lenth', function () {
            expect(nbIterations).to.be.equal(5);
        });

        it('should have executed the callback with the correct parameters', function () {
            expect(result).to.be.equal(10);
        });
    });

    xdescribe('loopConstrict', function () {
        it('should return a json indexed by the name of files', function () {
            console.log(loopConstrict([path.join(testCWD, testDirectory, testFile)], []));
            expect(loopConstrict([path.join(testCWD, testDirectory, testFile)], [])).to.be.eql({});
        });
    });

    xdescribe('merge', function () {
        before(function () {
            var json = { test: 'test' };
            fs.writeJsonSync(path.join(__dirname, 'file.json'), json);
        });

        after(function () {
            fs.removeSync(path.join(__dirname, 'file.json'));
        });

        it('should merge json files', function () {
            var json = { test2: 'test2' };
            var merged = lib.merge(path.join(__dirname, 'file.json'), json);
            expect(merged.test).to.be.a('string');
            expect(merged.test2).to.be.a('string');
        });

        it('should return normal object when no file exists', function () {
            var json = { test2: 'test2' };
            var merged = lib.merge(path.join(__dirname, 'file2.json'), json);
            expect(merged).to.be.eql(json);
        });
    });

    describe('constrict', function () {
        before(createTestFiles);
        afterEach(function () {
            fs.removeSync(path.join(__dirname, '.config'));
        });
        var expected = {};
        expected[path.join(__dirname, testDirectory, testFile)] = {
            content: 'content'
        };

        it('should output an object', function () {
            var output = lib.constrict({
                files: [path.join(__dirname, testDirectory, testFile)],
                cwd: __dirname
            });
            expect(output).to.be.an('object');
            expect(output).to.be.eql(expected);
        });

        it('should throw when no files are targeted or no options are provided', function () {
            expect(lib.constrict).to.throw(Error);
            expect(lib.constrict.bind(null, { pattern: './inexistant/*' })).to.throw(Error);
        });

        it('should write the output into a file when "destination" provided', function () {
            var output = lib.constrict({
                files: [path.join(__dirname, testDirectory, testFile)],
                cwd: __dirname,
                destination: '.config'
            });
            var content = fs.readJsonSync(path.join(__dirname, '.config'));

            expect(path.join(__dirname, '.config'))
                .to.be.a.file();
            expect(content).to.be.eql(expected);
        });
    });

    describe('liberate', function () {});
});
