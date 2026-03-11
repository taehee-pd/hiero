import { parseSvgPath } from './parse';
import type { State, TopologyContract } from '@/lib/schema/types';

export function computeTopology(state: State): TopologyContract {
  return buildTopology(state, false);
}

export function lockTopology(state: State): TopologyContract {
  return buildTopology(state, true);
}

export function areTopologiesCompatible(
  a: TopologyContract,
  b: TopologyContract,
): { compatible: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  if (a.layerPairs.length !== b.layerPairs.length) {
    mismatches.push(
      `Layer count differs: expected ${a.layerPairs.length}, received ${b.layerPairs.length}.`,
    );
  }

  const pairCount = Math.min(a.layerPairs.length, b.layerPairs.length);
  for (let index = 0; index < pairCount; index += 1) {
    const expected = a.layerPairs[index]!;
    const received = b.layerPairs[index]!;
    const label = describeLayerPair(index, expected.layerId, received.layerId);

    if (expected.layerId !== received.layerId) {
      mismatches.push(
        `${label} layer id differs: expected "${expected.layerId}", received "${received.layerId}".`,
      );
    }
    if (expected.subpathCount !== received.subpathCount) {
      mismatches.push(
        `${label} subpath count differs: expected ${expected.subpathCount}, received ${received.subpathCount}.`,
      );
    }
    if (!arrayEquals(expected.commandSignature, received.commandSignature)) {
      mismatches.push(
        `${label} command signature differs: expected [${expected.commandSignature.join(', ')}], received [${received.commandSignature.join(', ')}].`,
      );
    }
    if (!arrayEquals(expected.closed, received.closed)) {
      mismatches.push(
        `${label} closed flags differ: expected [${expected.closed.join(', ')}], received [${received.closed.join(', ')}].`,
      );
    }
  }

  return { compatible: mismatches.length === 0, mismatches };
}

function buildTopology(state: State, locked: boolean): TopologyContract {
  return {
    locked,
    layerPairs: Object.values(state.layers)
      .filter((layer) => typeof layer.path?.d === 'string' && layer.path.d.length > 0)
      .map((layer) => {
        const parsed = parseSvgPath(layer.path!.d);
        return {
          layerId: layer.id,
          subpathCount: parsed.subPaths.length,
          commandSignature: expandCommandSignature(layer.path!.d),
          closed: parsed.subPaths.map((subPath) => subPath.closed),
        };
      }),
  };
}

function expandCommandSignature(d: string): string[] {
  const tokens = tokenize(d);
  const signature: string[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index++];
    if (!token || !/^[a-zA-Z]$/.test(token)) continue;

    const command = token.toUpperCase();
    switch (command) {
      case 'M': {
        if (hasNumbers(tokens, index, 2)) {
          signature.push('M');
          index += 2;
        }
        while (hasNumbers(tokens, index, 2)) {
          signature.push('L');
          index += 2;
        }
        break;
      }
      case 'L':
        index = appendRepeatedCommand(signature, tokens, index, 'L', 2);
        break;
      case 'H':
        index = appendRepeatedCommand(signature, tokens, index, 'H', 1);
        break;
      case 'V':
        index = appendRepeatedCommand(signature, tokens, index, 'V', 1);
        break;
      case 'C':
        index = appendRepeatedCommand(signature, tokens, index, 'C', 6);
        break;
      case 'Q':
        index = appendRepeatedCommand(signature, tokens, index, 'Q', 4);
        break;
      case 'A':
        index = appendRepeatedCommand(signature, tokens, index, 'A', 7);
        break;
      case 'Z':
        signature.push('Z');
        break;
      default:
        break;
    }
  }

  return signature;
}

function appendRepeatedCommand(
  signature: string[],
  tokens: string[],
  index: number,
  command: string,
  groupSize: number,
) {
  while (hasNumbers(tokens, index, groupSize)) {
    signature.push(command);
    index += groupSize;
  }
  return index;
}

function hasNumbers(tokens: string[], index: number, count: number) {
  for (let offset = 0; offset < count; offset += 1) {
    if (!isNumber(tokens[index + offset])) {
      return false;
    }
  }
  return true;
}

function isNumber(token: string | undefined): token is string {
  return typeof token === 'string' && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(token);
}

function tokenize(d: string): string[] {
  const tokens: string[] = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(d)) !== null) {
    tokens.push(match[0]);
  }

  return tokens;
}

function arrayEquals<T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function describeLayerPair(index: number, expectedLayerId: string, receivedLayerId: string) {
  if (expectedLayerId === receivedLayerId) {
    return `Layer "${expectedLayerId}"`;
  }
  return `Layer ${index + 1} ("${expectedLayerId}" vs "${receivedLayerId}")`;
}
