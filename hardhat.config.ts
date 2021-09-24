import '@nomiclabs/hardhat-waffle';
import dotenv from 'dotenv';

dotenv.config();

const { ALCHEMY_RINKEBY_API_KEY, PRIVATE_KEY } = process.env;

const publicNetworks = PRIVATE_KEY
  ? {
      rinkeby: {
        url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_RINKEBY_API_KEY}`,
        accounts: [PRIVATE_KEY],
      },
      polygontestnet: {
        url: 'https://matic-mumbai.chainstacklabs.com',
        chainId: 80001,
        accounts: [PRIVATE_KEY],
        gasPrice: 8000000000, // https://github.com/nomiclabs/hardhat/issues/1828#issuecomment-906757428
      },
    }
  : {};

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
    ...publicNetworks,
  },
  solidity: {
    version: '0.8.4',
  },
};
