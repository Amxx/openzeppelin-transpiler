import _test, { TestInterface } from 'ava';
import bre from '@nomiclabs/buidler';
import { promises as fs } from 'fs';
import path from 'path';

import { findAll } from 'solidity-ast/utils';
import { getNodeBounds } from './solc/ast-utils';
import { SolcInput, SolcOutput } from './solc/input-output';
import { Transform } from './transform';

import { renameIdentifiers } from './transformations/rename-identifiers';
import { prependInitializableBase } from './transformations/prepend-initializable-base';
import { removeStateVarInits } from './transformations/purge-var-inits';
import { removeImmutable } from './transformations/remove-immutable';
import { removeInheritanceListArguments } from './transformations/remove-inheritance-list-args';
import { renameContractDefinition } from './transformations/rename-contract-definition';
import { fixImportDirectives } from './transformations/fix-import-directives';
import { fixNewStatement } from './transformations/fix-new-statement';
import { addRequiredPublicInitializer } from './transformations/add-required-public-initializers';
import { appendInitializableImport } from './transformations/append-initializable-import';
import { addStorageGaps } from './transformations/add-storage-gaps';
import {
  transformConstructor,
  removeLeftoverConstructorHead,
} from './transformations/transform-constructor';

const test = _test as TestInterface<Context>;

interface Context {
  solcInput: SolcInput;
  solcOutput: SolcOutput;
  transform: Transform;
}

test.serial.before('compile', async t => {
  t.context.solcInput = JSON.parse(
    await fs.readFile(path.join(bre.config.paths.cache, 'solc-input.json'), 'utf8'),
  );
  t.context.solcOutput = JSON.parse(
    await fs.readFile(path.join(bre.config.paths.cache, 'solc-output.json'), 'utf8'),
  );
});

test.beforeEach('transform', async t => {
  t.context.transform = new Transform(t.context.solcInput, t.context.solcOutput);
});

test('read', t => {
  const text = t.context.transform.read({ src: '0:6:0' });
  t.deepEqual('pragma', text);
});

test('apply + read', t => {
  t.context.transform.apply(function* () {
    yield { kind: 'a', start: 1, length: 0, text: '~' };
  });
  const text = t.context.transform.read({ src: '0:6:0' });
  t.deepEqual('p~ragma', text);
});

test('apply + read invalid', t => {
  t.context.transform.apply(function* () {
    yield { kind: 'a', start: 1, length: 2, text: '~~' };
  });

  t.throws(() => t.context.transform.read({ src: '2:2:0' }));
});

test('remove functions', t => {
  const file = 'contracts/TransformRemove.sol';
  t.context.transform.apply(function* (sourceUnit) {
    if (sourceUnit.absolutePath === file) {
      for (const node of findAll('FunctionDefinition', sourceUnit)) {
        yield { ...getNodeBounds(node), kind: 'remove', text: '' };
      }
    }
  });

  t.snapshot(t.context.transform.results()[file]);
});

test('rename identifiers', t => {
  const file = 'test/solc-0.6/contracts/Rename.sol';
  t.context.transform.apply(renameIdentifiers);
  t.snapshot(t.context.transform.results()[file]);
});

test('prepend Initializable base', t => {
  const file = 'test/solc-0.6/contracts/Rename.sol';
  t.context.transform.apply(prependInitializableBase);
  t.snapshot(t.context.transform.results()[file]);
});

test('purge var inits', t => {
  const file = 'test/solc-0.6/contracts/ElementaryTypes.sol';
  t.context.transform.apply(removeStateVarInits);
  t.snapshot(t.context.transform.results()[file]);
});

test('remove inheritance args', t => {
  const file = 'contracts/TransformInheritanceArgs.sol';
  t.context.transform.apply(removeInheritanceListArguments);
  t.snapshot(t.context.transform.results()[file]);
});

test('transform contract name', t => {
  const file = 'test/solc-0.6/contracts/Rename.sol';
  t.context.transform.apply(renameContractDefinition);
  t.snapshot(t.context.transform.results()[file]);
});

test('fix import directives', t => {
  const file = 'test/solc-0.6/contracts/Local.sol';
  t.context.transform.apply(fixImportDirectives);
  t.snapshot(t.context.transform.results()[file]);
});

test('fix import directives complex', t => {
  const file = 'contracts/TransformImport2.sol';
  t.context.transform.apply(renameIdentifiers);
  t.context.transform.apply(fixImportDirectives);
  t.snapshot(t.context.transform.results()[file]);
});

test('append initializable import', t => {
  const file = 'test/solc-0.6/contracts/Local.sol';
  t.context.transform.apply(appendInitializableImport('test/solc-0.6/contracts/Initializable.sol'));
  t.snapshot(t.context.transform.results()[file]);
});

test('append initializable import custom', t => {
  const file = 'test/solc-0.6/contracts/Local.sol';
  t.context.transform.apply(
    appendInitializableImport('test/solc-0.6/contracts/Initializable2.sol'),
  );
  t.snapshot(t.context.transform.results()[file]);
});

test('transform constructor', t => {
  const file = 'contracts/TransformConstructor.sol';
  t.context.transform.apply(transformConstructor);
  t.context.transform.apply(removeLeftoverConstructorHead);
  t.snapshot(t.context.transform.results()[file]);
});

test('fix new statement', t => {
  const file = 'contracts/TransformNew.sol';
  t.context.transform.apply(fixNewStatement);
  t.context.transform.apply(addRequiredPublicInitializer([]));
  t.snapshot(t.context.transform.results()[file]);
});

test('exclude', t => {
  const file = 'contracts/TransformInitializable.sol';
  const transform = new Transform(t.context.solcInput, t.context.solcOutput, {
    exclude: s => s === file,
  });
  // eslint-disable-next-line require-yield
  transform.apply(function* (s) {
    t.not(s.absolutePath, file);
  });
  t.false(file in transform.results());
});

test('add storage gaps', t => {
  const file = 'contracts/TransformAddGap.sol';
  t.context.transform.apply(addStorageGaps);
  t.snapshot(t.context.transform.results()[file]);
});

test('add requested public initializer', t => {
  const file = 'contracts/TransformConstructorWithArgs.sol';
  t.context.transform.apply(addRequiredPublicInitializer([file]));
  t.snapshot(t.context.transform.results()[file]);
});

test('remove immutable', t => {
  const file = 'contracts/TransformImmutable.sol';
  t.context.transform.apply(removeImmutable);
  t.snapshot(t.context.transform.results()[file]);
});
