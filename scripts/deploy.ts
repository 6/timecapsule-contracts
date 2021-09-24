import { ethers } from 'hardhat';

const main = async () => {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts with the account:', deployer.address);

  console.log('Account balance:', (await deployer.getBalance()).toString());

  const TokenContractFactory = await ethers.getContractFactory('TokenSolidity');
  const token = await TokenContractFactory.deploy();

  console.log('Token address:', token.address);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
