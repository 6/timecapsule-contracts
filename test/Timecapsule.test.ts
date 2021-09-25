import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, ContractFactory, constants } from 'ethers';

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
  let signer3: SignerWithAddress;

  beforeEach(async () => {
    contractFactory = await ethers.getContractFactory('Timecapsule');
    contract = await contractFactory.deploy();
    [owner, signer1, signer2, signer3] = await ethers.getSigners();
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

      const tx = await contract
        .connect(signer1)
        .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('1.23') });
      const txReceipt = await tx.wait();
      const block = await txReceipt.events[0].getBlock();

      expect(await contract.getCapsulesCount(signer2.address)).toEqual(BigNumber.from(1));
      expect(await contract.getPendingBalance(signer2.address)).toEqual(
        ethers.utils.parseEther('1.23'),
      );

      const capsule = await contract.getCapsule(signer2.address, 0);
      expect(capsule.from).toEqual(signer1.address);
      expect(capsule.value).toEqual(ethers.utils.parseEther('1.23'));
      expect(capsule.createdAt).toEqual(BigNumber.from(block.timestamp));
      expect(capsule.unlocksAt).toEqual(futureTimestamp);
    });

    it('transfers the value from the senders account to the contract', async () => {
      const originalBalance = await signer1.getBalance();

      const value = ethers.utils.parseEther('1.23');
      const tx = await contract.connect(signer1).send(signer2.address, futureTimestamp, { value });
      const txReceipt = await tx.wait();
      const txFee = txReceipt.gasUsed * txReceipt.effectiveGasPrice;

      expect(tx.value).toEqual(value);

      const newBalance = await signer1.getBalance();
      expect(newBalance).toEqual(originalBalance.sub(value).sub(txFee));
    });

    it('emits a CapsuleSent event', async () => {
      const tx = await contract
        .connect(signer1)
        .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('1.23') });

      expect(tx).toHaveEmittedWith(contract, 'CapsuleSent', [
        BigNumber.from(0),
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

  describe('open', () => {
    describe('unlocked', () => {
      beforeEach(async () => {
        await contract
          .connect(signer1)
          .send(signer2.address, pastTimestamp, { value: ethers.utils.parseEther('1.23') });

        await contract
          .connect(signer1)
          .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('2') });
      });

      it('transfers the balance to the recipient', async () => {
        const originalBalance = await signer2.getBalance();

        const tx = await contract.connect(signer2).open(0);
        const txReceipt = await tx.wait();
        const txFee = txReceipt.gasUsed * txReceipt.effectiveGasPrice;

        const newBalance = await signer2.getBalance();
        expect(newBalance).toEqual(originalBalance.add(ethers.utils.parseEther('1.23').sub(txFee)));
      });

      it('reduces pending balance of the recipient and sets capsule opened property', async () => {
        expect(await contract.getPendingBalance(signer2.address)).toEqual(
          ethers.utils.parseEther('3.23'),
        );
        expect((await contract.getCapsule(signer2.address, 0)).opened).toEqual(false);

        await contract.connect(signer2).open(0);

        expect(await contract.getPendingBalance(signer2.address)).toEqual(
          ethers.utils.parseEther('2'),
        );
        expect((await contract.getCapsule(signer2.address, 0)).opened).toEqual(true);
      });

      it('emits a CapsuleOpened event', async () => {
        const tx = await contract.connect(signer2).open(0);
        expect(tx).toHaveEmittedWith(contract, 'CapsuleOpened', [
          BigNumber.from(0),
          signer2.address,
          ethers.utils.parseEther('1.23'),
        ]);
      });
    });

    describe('not yet unlocked', () => {
      beforeEach(async () => {
        await contract
          .connect(signer1)
          .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('1.23') });
      });

      it('reverts and does not open or modify balance', async () => {
        expect(contract.connect(signer2).open(0)).toBeRevertedWith('Not unlocked yet');

        const capsule = await contract.getCapsule(signer2.address, 0);
        expect(capsule.opened).toEqual(false);
        expect(await contract.getPendingBalance(signer2.address)).toEqual(
          ethers.utils.parseEther('1.23'),
        );
      });
    });

    describe('already opened', () => {
      beforeEach(async () => {
        await contract
          .connect(signer1)
          .send(signer2.address, pastTimestamp, { value: ethers.utils.parseEther('1.23') });
        await contract.connect(signer2).open(0);
      });

      it('reverts and does not modify balance', async () => {
        expect(contract.connect(signer2).open(0)).toBeRevertedWith('Already opened');

        expect(await contract.getPendingBalance(signer2.address)).toEqual(BigNumber.from(0));
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

  describe('undoSend', () => {
    describe('can be undone', () => {
      beforeEach(async () => {
        await contract
          .connect(signer1)
          .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('1.23') });
      });

      it('transfers balance back to sender address', async () => {
        const originalBalance = await signer1.getBalance();

        const tx = await contract.connect(signer1).undoSend(signer2.address, 0);
        const txReceipt = await tx.wait();
        const txFee = txReceipt.effectiveGasPrice * txReceipt.gasUsed;

        const newBalance = await signer1.getBalance();
        expect(newBalance).toEqual(originalBalance.add(ethers.utils.parseEther('1.23')).sub(txFee));
      });

      it('deletes the capsule', async () => {
        await contract.connect(signer1).undoSend(signer2.address, 0);

        // returns nullish struct by default:
        const capsule = await contract.getCapsule(signer2.address, 0);
        expect(capsule.from).toEqual(constants.AddressZero);
        expect(capsule.value).toEqual(BigNumber.from(0));
      });

      it('reduces the pending balance and capsules count', async () => {
        expect(await contract.getCapsulesCount(signer2.address)).toEqual(BigNumber.from(1));
        expect(await contract.getPendingBalance(signer2.address)).toEqual(
          ethers.utils.parseEther('1.23'),
        );

        await contract.connect(signer1).undoSend(signer2.address, 0);

        expect(await contract.getCapsulesCount(signer2.address)).toEqual(BigNumber.from(0));
        expect(await contract.getPendingBalance(signer2.address)).toEqual(BigNumber.from(0));
      });

      it('emits event', async () => {
        const tx = await contract.connect(signer1).undoSend(signer2.address, 0);
        expect(tx).toHaveEmittedWith(contract, 'UndidCapsuleSend', [
          BigNumber.from(0),
          signer1.address,
          signer2.address,
          futureTimestamp,
          ethers.utils.parseEther('1.23'),
        ]);
      });
    });

    describe('msg.sender did not send the capsule', () => {
      beforeEach(async () => {
        await contract
          .connect(signer1)
          .send(signer2.address, futureTimestamp, { value: ethers.utils.parseEther('1.23') });
      });

      it('reverts', async () => {
        await expect(contract.connect(signer3).undoSend(signer2.address, 0)).toBeRevertedWith(
          'You did not send this capsule',
        );
      });
    });

    describe('capsule already opened', () => {
      beforeEach(async () => {
        await contract
          .connect(signer1)
          .send(signer2.address, pastTimestamp, { value: ethers.utils.parseEther('1.23') });
        await contract.connect(signer2).open(0);
      });

      it('reverts', async () => {
        await expect(contract.connect(signer1).undoSend(signer2.address, 0)).toBeRevertedWith(
          'Capsule already opened',
        );
      });
    });

    describe('undo capability expired', () => {
      // TODO: figure out how to test this
    });
  });
});
