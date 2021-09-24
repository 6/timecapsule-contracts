import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, ContractFactory } from 'ethers';

describe('Timecapsule', () => {
  // Dec 25, 2029
  const futureTimestamp = BigNumber.from(1892920226);
  // June 23, 2020
  const pastTimestamp = BigNumber.from(1592920226);

  let contractFactory: ContractFactory;
  let contract: Contract;
  let owner: SignerWithAddress;
  let signer1: SignerWithAddress;
  let signer2: SignerWithAddress;

  beforeEach(async () => {
    contractFactory = await ethers.getContractFactory('Timecapsule');
    contract = await contractFactory.deploy();
    [owner, signer1, signer2] = await ethers.getSigners();
  });

  describe('initial deployment', () => {
    it('sets the correct contract owner', async () => {
      expect(await contract.owner()).toEqual(owner.address);
    });
  });

  describe('send', () => {
    it('sends a Capsule', async () => {
      expect(await contract.getCapsulesCount(signer2.address)).toEqual(BigNumber.from(0));
      expect(await contract.getPendingBalance(signer2.address)).toEqual(BigNumber.from(0));

      await contract
        .connect(signer1)
        .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('1.23') });

      expect(await contract.getCapsulesCount(signer2.address)).toEqual(BigNumber.from(1));
      expect(await contract.getPendingBalance(signer2.address)).toEqual(
        ethers.utils.parseEther('1.23'),
      );

      const capsule = await contract.getCapsule(signer2.address, 0);
      expect(capsule.from).toEqual(signer1.address);
      expect(capsule.value).toEqual(ethers.utils.parseEther('1.23'));
      expect(capsule.unlocksAt).toEqual(futureTimestamp);
    });

    it('emits a CapsuleSent event', async () => {
      const tx = await contract
        .connect(signer1)
        .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('1.23') });

      expect(tx).toHaveEmittedWith(contract, 'CapsuleSent', [
        signer1.address,
        signer2.address,
        ethers.utils.parseEther('1.23'),
        futureTimestamp,
      ]);
    });

    describe('amount is <= 0', () => {
      it('reverts and does not create capsule', async () => {
        expect(
          contract
            .connect(signer1)
            .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('0') }),
        ).toBeRevertedWith('Amount must be >0');

        expect(await contract.getCapsulesCount(signer2.address)).toEqual(BigNumber.from(0));
      });
    });
  });

  describe('transferOwnership', () => {
    it('transfers ownership to the provided new owner', async () => {
      const tx = await contract.transferOwnership(signer1.address);
      expect(tx).toHaveEmittedWith(contract, 'TransferOwnership', [owner.address, signer1.address]);

      expect(await contract.owner()).toEqual(signer1.address);
    });

    it('cannot be called by a non-owner', async () => {
      await expect(contract.connect(signer1).transferOwnership(signer2.address)).toBeRevertedWith(
        'Must be owner to call',
      );

      expect(await contract.owner()).toEqual(owner.address);
    });
  });
});
