// transpile:mocha

import {getParser} from '../lib/cli/parser';
import { INSTALL_TYPES } from '../lib/extension-config';
import { registerSchema, reset } from '../lib/schema';
import path from 'path';
import { readConfigFile } from '../lib/config-file';

// these paths should not make assumptions about the current working directory
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const ALLOW_FIXTURE = path.join(FIXTURE_DIR, 'allow-feat.txt');
const DENY_FIXTURE = path.join(FIXTURE_DIR, 'deny-feat.txt');
const CAPS_FIXTURE = path.join(FIXTURE_DIR, 'caps.json');

describe('parser', function () {
  let p;

  describe('Main Parser', function () {
    beforeEach(async function () {
      p = await getParser(true);
    });

    it('should accept only server and driver subcommands', function () {
      p.parse_args([]);
      p.parse_args(['server']);
      p.parse_args(['driver', 'list']);
      (() => p.parse_args(['foo'])).should.throw();
      (() => p.parse_args(['foo --bar'])).should.throw();
    });
  });

  describe('Server Parser', function () {
    describe('Appium arguments', function () {
      beforeEach(async function () {
        p = await getParser(true);
      });

      it('should return an arg parser', function () {
        should.exist(p.parse_args);
        p.parse_args([]).should.have.property('port');
      });
      it('should default to the server subcommand', function () {
        p.parse_args([]).subcommand.should.eql('server');
        p.parse_args([]).should.eql(p.parse_args(['server']));
      });
      it('should keep the raw server flags array', function () {
        should.exist(p.rawArgs);
      });
      it('should have help for every arg', function () {
        for (let arg of p.rawArgs) {
          arg[1].should.have.property('help');
        }
      });
      it('should throw an error with unknown argument', function () {
        (() => {p.parse_args(['--apple']);}).should.throw();
      });
      it('should parse default capabilities correctly from a string', function () {
        let defaultCapabilities = {a: 'b'};
        let args = p.parse_args(['--default-capabilities', JSON.stringify(defaultCapabilities)]);
        args.defaultCapabilities.should.eql(defaultCapabilities);
      });
      it('should parse default capabilities correctly from a file', function () {
        let defaultCapabilities = {a: 'b'};
        let args = p.parse_args(['--default-capabilities', CAPS_FIXTURE]);
        args.defaultCapabilities.should.eql(defaultCapabilities);
      });
      it('should throw an error with invalid arg to default capabilities', function () {
        (() => {p.parse_args(['-dc', '42']);}).should.throw();
        (() => {p.parse_args(['-dc', 'false']);}).should.throw();
        (() => {p.parse_args(['-dc', 'null']);}).should.throw();
        (() => {p.parse_args(['-dc', 'does/not/exist.json']);}).should.throw();
      });
      it('should parse --allow-insecure correctly', function () {
        p.parse_args([]).should.have.property('allowInsecure', undefined);
        p.parse_args(['--allow-insecure', '']).allowInsecure.should.eql([]);
        p.parse_args(['--allow-insecure', 'foo']).allowInsecure.should.eql(['foo']);
        p.parse_args(['--allow-insecure', 'foo,bar']).allowInsecure.should.eql(['foo', 'bar']);
        p.parse_args(['--allow-insecure', 'foo ,bar']).allowInsecure.should.eql(['foo', 'bar']);
      });
      it('should parse --deny-insecure correctly', function () {
        p.parse_args([]).should.have.property('denyInsecure', undefined);
        p.parse_args(['--deny-insecure', '']).denyInsecure.should.eql([]);
        p.parse_args(['--deny-insecure', 'foo']).denyInsecure.should.eql(['foo']);
        p.parse_args(['--deny-insecure', 'foo,bar']).denyInsecure.should.eql(['foo', 'bar']);
        p.parse_args(['--deny-insecure', 'foo ,bar']).denyInsecure.should.eql(['foo', 'bar']);
      });
      it('should parse --allow-insecure & --deny-insecure from files', function () {
        const parsed = p.parse_args([
          '--allow-insecure', ALLOW_FIXTURE, '--deny-insecure', DENY_FIXTURE
        ]);
        parsed.allowInsecure.should.eql(['feature1', 'feature2', 'feature3']);
        parsed.denyInsecure.should.eql(['nofeature1', 'nofeature2', 'nofeature3']);
      });
    });

    describe('extension arguments', function () {
      beforeEach(async function () {
        reset();
        registerSchema('driver', 'fake', require('@appium/fake-driver/build/lib/fake-driver-schema').default);
        p = await getParser(true);
      });

      it('should parse default driver args correctly from a string', async function () {
        // this test reads the actual schema provided by the fake driver.
        // the config file corresponds to that schema.
        // the command-line flags are derived also from the schema.
        // the result should be that the parsed args should match the config file.
        const {config} = await readConfigFile(require.resolve('./fixtures/config/driver-fake.config.json'));
        const fakeDriverArgs = {fake: {sillyWebServerPort: 1234, sillyWebServerHost: 'hey'}};
        const args = p.parse_args([
          '--driver-fake-silly-web-server-port',
          fakeDriverArgs.fake.sillyWebServerPort,
          '--driver-fake-silly-web-server-host',
          fakeDriverArgs.fake.sillyWebServerHost
        ]);

        args.driver.fake.should.eql(config.driver.fake);
      });

      // XXX: we may want to not support this use-case any longer, as it can all be done w/ a config file.
      it('should not support --driver-args', function () {
        (() => p.parse_args(['--driver-args', '/some/file.json'])).should.throw(/unrecognized arguments/i);
      });

      it('should not support --plugin-args', function () {
        (() => p.parse_args(['--plugin-args', '/some/file.json'])).should.throw(/unrecognized arguments/i);
      });

    });
  });

  describe('Driver Parser', function () {
    it('should not allow random sub-subcommands', function () {
      (() => p.parse_args(['driver', 'foo'])).should.throw();
    });
    describe('list', function () {
      it('should allow an empty argument list', function () {
        const args = p.parse_args(['driver', 'list']);
        args.subcommand.should.eql('driver');
        args.driverCommand.should.eql('list');
        args.showInstalled.should.eql(false);
        args.showUpdates.should.eql(false);
        args.json.should.eql(false);
      });
      it('should allow json format', function () {
        const args = p.parse_args(['driver', 'list', '--json']);
        args.json.should.eql(true);
      });
      it('should allow --installed', function () {
        const args = p.parse_args(['driver', 'list', '--installed']);
        args.showInstalled.should.eql(true);
      });
      it('should allow --updates', function () {
        const args = p.parse_args(['driver', 'list', '--updates']);
        args.showUpdates.should.eql(true);
      });
    });
    describe('install', function () {
      it('should not allow an empty argument list', function () {
        (() => p.parse_args(['driver', 'install'])).should.throw();
      });
      it('should take a driver name to install', function () {
        const args = p.parse_args(['driver', 'install', 'foobar']);
        args.subcommand.should.eql('driver');
        args.driverCommand.should.eql('install');
        args.driver.should.eql('foobar');
        should.not.exist(args.installType);
        args.json.should.eql(false);
      });
      it('should allow json format', function () {
        const args = p.parse_args(['driver', 'install', 'foobar', '--json']);
        args.json.should.eql(true);
      });
      it('should allow --source', function () {
        for (const source of INSTALL_TYPES) {
          const args = p.parse_args(['driver', 'install', 'foobar', '--source', source]);
          args.installType.should.eql(source);
        }
      });
      it('should not allow unknown --source', function () {
        (() => p.parse_args(['driver', 'install', 'fobar', '--source', 'blah'])).should.throw();
      });
    });
    describe('uninstall', function () {
      it('should not allow an empty argument list', function () {
        (() => p.parse_args(['driver', 'uninstall'])).should.throw();
      });
      it('should take a driver name to uninstall', function () {
        const args = p.parse_args(['driver', 'uninstall', 'foobar']);
        args.subcommand.should.eql('driver');
        args.driverCommand.should.eql('uninstall');
        args.driver.should.eql('foobar');
        args.json.should.eql(false);
      });
      it('should allow json format', function () {
        const args = p.parse_args(['driver', 'uninstall', 'foobar', '--json']);
        args.json.should.eql(true);
      });
    });
    describe('update', function () {
      it('should not allow an empty argument list', function () {
        (() => p.parse_args(['driver', 'update'])).should.throw();
      });
      it('should take a driver name to update', function () {
        const args = p.parse_args(['driver', 'update', 'foobar']);
        args.subcommand.should.eql('driver');
        args.driverCommand.should.eql('update');
        args.driver.should.eql('foobar');
        args.json.should.eql(false);
      });
      it('should allow json format', function () {
        const args = p.parse_args(['driver', 'update', 'foobar', '--json']);
        args.json.should.eql(true);
      });
    });
    describe('run', function () {
      it('should not allow an empty driver argument list', function () {
        (() => p.parse_args(['driver', 'run'])).should.throw();
      });
      it('should not allow no driver scriptName', function () {
        (() => p.parse_args(['driver', 'run', 'foo'])).should.throw();
      });
      it('should take a driverName and scriptName to run', function () {
        const args = p.parse_args(['driver', 'run', 'foo', 'bar']);
        args.subcommand.should.eql('driver');
        args.driverCommand.should.eql('run');
        args.driver.should.eql('foo');
        args.scriptName.should.eql('bar');
        args.json.should.eql(false);
      });
      it('should allow json format for driver', function () {
        const args = p.parse_args(['driver', 'run', 'foo', 'bar', '--json']);
        args.json.should.eql(true);
      });
      it('should not allow an empty plugin argument list', function () {
        (() => p.parse_args(['plugin', 'run'])).should.throw();
      });
      it('should not allow no plugin scriptName', function () {
        (() => p.parse_args(['plugin', 'run', 'foo'])).should.throw();
      });
      it('should take a pluginName and scriptName to run', function () {
        const args = p.parse_args(['plugin', 'run', 'foo', 'bar']);
        args.subcommand.should.eql('plugin');
        args.pluginCommand.should.eql('run');
        args.plugin.should.eql('foo');
        args.scriptName.should.eql('bar');
        args.json.should.eql(false);
      });
      it('should allow json format for plugin', function () {
        const args = p.parse_args(['plugin', 'run', 'foo', 'bar', '--json']);
        args.json.should.eql(true);
      });
    });
  });
});
