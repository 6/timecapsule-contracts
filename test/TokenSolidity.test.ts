import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, ContractFactory, constants } from 'ethers';

const TOTAL_SUPPLY = BigNumber.from(1000000000);

describe('Token (Solidity)', () => {
  let contractFactory: ContractFactory;
  let token: Contract;
  let owner: SignerWithAddress;
  let signers: Array<SignerWithAddress>;

  beforeEach(async () => {
    contractFactory = await ethers.getContractFactory('TokenSolidity');
    token = await contractFactory.deploy();
    [owner, ...signers] = await ethers.getSigners();
  });

  describe('initial deployment', () => {
    it('sets the correct total supply', async () => {
      const totalSupply = await token.totalSupply();
      expect(totalSupply).toEqual(TOTAL_SUPPLY);
    });

    it('assigns total supply of tokens to the owner', async () => {
      const ownerBalance = await token.balanceOf(owner.address);
      expect(ownerBalance).toEqual(TOTAL_SUPPLY);
    });

    it('sets the correct contract owner', async () => {
      expect(await token.owner()).toEqual(owner.address);
    });

    it('sets token name and symbol', async () => {
      expect(await token.name()).toEqual('Simple Token');
      expect(await token.symbol()).toEqual('SMPL');
    });
  });

  describe('transfers', () => {
    it('transfers tokens between accounts, updating balances correctly', async () => {
      const [signer1, signer2] = signers;

      expect(await token.balanceOf(owner.address)).toEqual(TOTAL_SUPPLY);
      expect(await token.balanceOf(signer1.address)).toEqual(BigNumber.from(0));
      expect(await token.balanceOf(signer2.address)).toEqual(BigNumber.from(0));

      // Transfer 50 tokens from owner to signer1
      await token.transfer(signer1.address, 50);
      expect(await token.balanceOf(owner.address)).toEqual(TOTAL_SUPPLY.sub(50));
      expect(await token.balanceOf(signer1.address)).toEqual(BigNumber.from(50));

      // Transfer 30 tokens from signer1 to signer2
      await token.connect(signer1).transfer(signer2.address, 30);
      expect(await token.balanceOf(signer1.address)).toEqual(BigNumber.from(20));
      expect(await token.balanceOf(signer2.address)).toEqual(BigNumber.from(30));
    });

    it('emits a Transfer event', async () => {
      const [signer1] = signers;

      const tx = await token.transfer(signer1.address, 50);
      expect(tx).toHaveEmittedWith(token, 'Transfer', [
        owner.address,
        signer1.address,
        BigNumber.from(50),
      ]);
    });

    it('reverts when insufficient balance', async () => {
      const [signer1] = signers;
      const initialOwnerBalance = await token.balanceOf(owner.address);

      await expect(token.connect(signer1).transfer(owner.address, 1)).toBeRevertedWith(
        'Not enough tokens',
      );

      // Owner balance shouldn't have changed.
      expect(await token.balanceOf(owner.address)).toEqual(initialOwnerBalance);
    });

    it('reverts when transferring 0 amount', async () => {
      const [signer1] = signers;

      await expect(token.transfer(signer1.address, 0)).toBeRevertedWith(
        'Transfer amount must be >0',
      );
    });

    it('reverts when transferring negative amount', async () => {
      const [signer1] = signers;

      await expect(token.transfer(signer1.address, -50)).toBeReverted();
    });

    it('reverts when sender is the zero address', async () => {
      const initialOwnerBalance = await token.balanceOf(owner.address);

      await expect(token.transfer(constants.AddressZero, 50)).toBeRevertedWith(
        'Cannot transfer to zero address',
      );

      // Owner balance shouldn't have changed.
      expect(await token.balanceOf(owner.address)).toEqual(initialOwnerBalance);
    });

    it('reverts when recipient is self', async () => {
      const initialOwnerBalance = await token.balanceOf(owner.address);

      await expect(token.transfer(owner.address, 50)).toBeRevertedWith('Cannot transfer to self');

      // Owner balance shouldn't have changed.
      expect(await token.balanceOf(owner.address)).toEqual(initialOwnerBalance);
    });
  });

  describe('freeze / unfreeze', () => {
    it('allows owner to freeze/unfreeze and address', async () => {
      const [signer1, signer2] = signers;

      expect(await token.isFrozen(signer1.address)).toEqual(false);
      expect(await token.isFrozen(signer2.address)).toEqual(false);

      await token.freeze(signer2.address);

      expect(await token.isFrozen(signer1.address)).toEqual(false);
      expect(await token.isFrozen(signer2.address)).toEqual(true);

      await token.unfreeze(signer2.address);

      expect(await token.isFrozen(signer1.address)).toEqual(false);
      expect(await token.isFrozen(signer2.address)).toEqual(false);
    });

    it('disables transfers sent from/to a frozen address', async () => {
      const [signer1, signer2] = signers;

      await token.transfer(signer1.address, 50);

      const freezeTx = await token.freeze(signer1.address);
      expect(freezeTx).toHaveEmittedWith(token, 'Freeze', [signer1.address]);

      // Can't do any transfers after frozen:
      await expect(token.connect(signer1).transfer(signer2.address, 10)).toBeRevertedWith(
        'Sender address is frozen',
      );

      await expect(token.transfer(signer1.address, 100)).toBeRevertedWith(
        'Recipient address is frozen',
      );

      expect(await token.balanceOf(signer1.address)).toEqual(BigNumber.from(50));

      // Once unfrozen, can transfer again:
      const unfreezeTx = await token.unfreeze(signer1.address);
      expect(unfreezeTx).toHaveEmittedWith(token, 'Unfreeze', [signer1.address]);
      await token.connect(signer1).transfer(signer2.address, 10);
      await token.transfer(signer1.address, 100);

      expect(await token.balanceOf(signer1.address)).toEqual(BigNumber.from(140));
    });

    it('disallows non-owner from freezing/unfreezing', async () => {
      const [signer1, signer2] = signers;

      await expect(token.connect(signer1).freeze(signer2.address)).toBeRevertedWith(
        'Must be owner to call',
      );

      expect(await token.isFrozen(signer2.address)).toEqual(false);

      await expect(token.connect(signer1).unfreeze(signer2.address)).toBeRevertedWith(
        'Must be owner to call',
      );

      expect(await token.isFrozen(signer2.address)).toEqual(false);
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

  describe('mint', () => {
    it('allows owner to mint more tokens to any recipient', async () => {
      const [signer1] = signers;

      const tx = await token.mint(signer1.address, 500);
      expect(tx).toHaveEmittedWith(token, 'Transfer', [
        constants.AddressZero,
        signer1.address,
        BigNumber.from(500),
      ]);

      expect(await token.balanceOf(signer1.address)).toEqual(BigNumber.from(500));
    });

    it('increases totalSupply by the minted amount', async () => {
      await token.mint(signers[0].address, 500);
      expect(await token.totalSupply()).toEqual(TOTAL_SUPPLY.add(500));
    });

    it('cannot be called by a non-owner', async () => {
      const [signer1, signer2] = signers;

      await expect(token.connect(signer1).mint(signer2.address, 500)).toBeRevertedWith(
        'Must be owner to call',
      );

      expect(await token.balanceOf(signer2.address)).toEqual(BigNumber.from(0));
    });
  });

  describe('burn', () => {
    beforeEach(async () => {
      const [signer1] = signers;
      await token.transfer(signer1.address, 500);
    });

    it('allows owner to burn tokens from on any address', async () => {
      const [signer1] = signers;

      const tx = await token.burn(signer1.address, 100);
      expect(tx).toHaveEmittedWith(token, 'Transfer', [
        signer1.address,
        constants.AddressZero,
        BigNumber.from(100),
      ]);

      expect(await token.balanceOf(signer1.address)).toEqual(BigNumber.from(400));
    });

    it('decreases totalSupply by the burned amount', async () => {
      await token.burn(signers[0].address, 500);
      expect(await token.totalSupply()).toEqual(TOTAL_SUPPLY.sub(500));
    });

    it('cannot be called by a non-owner', async () => {
      const [signer1, signer2] = signers;

      await expect(token.connect(signer2).burn(signer1.address, 100)).toBeRevertedWith(
        'Must be owner to call',
      );

      expect(await token.balanceOf(signer1.address)).toEqual(BigNumber.from(500));
    });
  });
});
