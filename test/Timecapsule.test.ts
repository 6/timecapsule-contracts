import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, ContractFactory, constants } from 'ethers';

describe('Timecapsule', () => {
  let contractFactory: ContractFactory;
  let token: Contract;
  let owner: SignerWithAddress;
  let signers: Array<SignerWithAddress>;

  beforeEach(async () => {
    contractFactory = await ethers.getContractFactory('Timecapsule');
    token = await contractFactory.deploy();
    [owner, ...signers] = await ethers.getSigners();
  });

  describe('initial deployment', () => {
    it('sets the correct contract owner', async () => {
      expect(await token.owner()).toEqual(owner.address);
    });
  });

  describe('transferOwnership', () => {
    it('transfers ownership to the provided new owner', async () => {
      const [signer1] = signers;

      const tx = await token.transferOwnership(signer1.address);
      expect(tx).toHaveEmittedWith(token, 'TransferOwnership', [owner.address, signer1.address]);

      expect(await token.owner()).toEqual(signer1.address);
    });

    it('cannot be called by a non-owner', async () => {
      const [signer1, signer2] = signers;

      await expect(token.connect(signer1).transferOwnership(signer2.address)).toBeRevertedWith(
        'Must be owner to call',
      );

      expect(await token.owner()).toEqual(owner.address);
    });
  });
});
