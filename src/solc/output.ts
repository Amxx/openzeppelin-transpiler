import { SourceUnit } from './ast-node';

export interface SolcOutput {
  contracts: {
    [file in string]: {
      [contract in string]: {
      };
    };
  };
  sources: {
    [file in string]: {
      ast: SourceUnit;
    };
  };
}