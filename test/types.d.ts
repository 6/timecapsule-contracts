// TODO: why is this needed?

import { BigNumber, Wallet, Contract } from 'ethers'; // eslint-disable-line @typescript-eslint/no-unused-vars

export type Numberish = number | string | BigNumber;

declare global {
  namespace jest {
    interface Matchers<R> {
      // misc matchers
      toBeProperAddress(): R;
      toBeProperPrivateKey(): R;
      toBeProperHex(length: number): R;

      // BigNumber matchers
      toEqBN(value: Numberish): R;
      toBeGtBN(value: Numberish): R;
      toBeLtBN(value: Numberish): R;
      toBeGteBN(value: Numberish): R;
      toBeLteBN(value: Numberish): R;

      // balance matchers
      toChangeBalance(wallet: Wallet, balanceChange: Numberish): Promise<R>;
      toChangeBalances(wallets: Wallet[], balanceChanges: Numberish[]): Promise<R>;

      // revert matchers
      toBeReverted(): Promise<R>;
      toBeRevertedWith(revertReason: string): Promise<R>;

      // emit matcher
      toHaveEmitted(contract: Contract, eventName: string): Promise<R>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toHaveEmittedWith(contract: Contract, eventName: string, expectedArgs: any[]): Promise<R>;

      // calledOnContract matchers
      toBeCalledOnContract(contract: Contract): R;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toBeCalledOnContractWith(contract: Contract, parameters: any[]): R;
    }
  }
}

declare module 'hardhat/types/runtime' {
  // This is an example of an extension to the Hardhat Runtime Environment.
  // This new field will be available in tasks' actions, scripts, and tests.
  export interface HardhatRuntimeEnvironment {
    timeAndMine: {
      increaseTime: (delta: string) => Promise<void>;
      setTimeIncrease: (delta: string) => Promise<void>;
      mine: (amount: number) => Promise<void>;
      setTime: (time: number) => Promise<void>;
      setTimeNextBlock: (time: number) => Promise<void>;
    };
  }
}

export {};
