import { getNodeSources, getConstructor, stripBraces } from '../solc/ast-utils';
import { getVarInits } from './get-var-inits';
import { Transformation } from './type';
import { buildSuperCallsForChain } from './build-super-calls-for-chain';
import { ContractDefinition } from '../solc/ast-node';
import { Artifact } from '../solc/artifact';
import { ArtifactsMap } from '../artifacts-map';

function getVarInitsPart(contractNode: ContractDefinition, source: string): string {
  return getVarInits(contractNode, source)
    .map(([vr, , match]) => `\n        ${vr.name} ${match[2]};`)
    .join('');
}

export function* transformConstructor(
  contractNode: ContractDefinition,
  source: string,
  contracts: Artifact[],
  contractsToArtifactsMap: ArtifactsMap,
): Generator<Transformation> {
  if (contractNode.contractKind !== 'contract') return;

  const superCalls = buildSuperCallsForChain(contractNode, contracts, contractsToArtifactsMap);

  const declarationInserts = getVarInitsPart(contractNode, source);

  const constructorNode = getConstructor(contractNode);

  let constructorBodySource = '';
  let constructorParameterList = '';
  let constructorArgsList = '';

  if (constructorNode) {
    if (constructorNode.body == null) throw new Error('Missing body for constructor definition');
    constructorBodySource = stripBraces(getNodeSources(constructorNode.body, source)[2]);
    constructorParameterList = stripBraces(getNodeSources(constructorNode.parameters, source)[2]);
    constructorArgsList = constructorNode.parameters.parameters.map(par => par.name).join(', ');
  }

  let bounds: { start: number, end: number };

  if (constructorNode) {
    const [start, len] = getNodeSources(constructorNode, source);
    bounds = {
      start,
      end: start + len,
    };
  } else {
    const [contractStart, , contractSource] = getNodeSources(contractNode, source);
    const match = /.*\bcontract[^\{]*{/.exec(contractSource);
    if (match == undefined) {
      throw new Error(`Can't find contract pattern in ${contractSource}`);
    }
    const inside = contractStart + match[0].length;
    bounds = {
      start: inside,
      end: inside,
    };
  }

  yield {
    ...bounds,
    kind: 'transform-constructor',
    text: `
    function __${contractNode.name}_init(${constructorParameterList}) internal initializer {${superCalls}
        __${contractNode.name}_init_unchained(${constructorArgsList});
    }

    function __${contractNode.name}_init_unchained(${constructorParameterList}) internal initializer {
        ${declarationInserts}
        ${constructorBodySource}
    }\n`,
  };
}
